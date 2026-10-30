// Package friendsapi serves the friends of a player account: its code, adding
// by code, accepting, removing, and the heartbeat that tells its friends
// whether it is online and which room it is in. Every route needs a player
// token, and the collections stay closed to the records API, so these routes
// are the only way in. They answer only the fields written below: never an
// email, a user id or an IP (server/README.md, "Friends").
package friendsapi

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/security"

	"github.com/fullfran/mazmorra-sombria/server/internal/friends"
)

const (
	maxBodyBytes = 1 << 10
	// A list never answers more than an account can hold.
	maxLinks = friends.MaxFriends + 2*friends.MaxPending
	// Attempts at drawing an unused code; a clash is already very rare.
	codeAttempts = 5
)

// A link id is a PocketBase id; anything else never reaches a query.
var validID = regexp.MustCompile(`^[a-z0-9]{15}$`)

var (
	errRefused = errors.New("refused")
	errLimit   = errors.New("limit")
)

type api struct {
	now     func() time.Time
	newCode func() string
}

// Register adds the friends routes to r.
func Register(r *router.Router[*core.RequestEvent]) {
	register(r, time.Now, randomCode)
}

func register(r *router.Router[*core.RequestEvent], now func() time.Time, newCode func() string) {
	a := &api{now: now, newCode: newCode}
	g := r.Group("/api/sd/friends")
	g.Bind(apis.RequireAuth("users"))
	g.BindFunc(func(e *core.RequestEvent) error {
		e.Response.Header().Set("Cache-Control", "no-store")
		return e.Next()
	})
	g.GET("", a.overview)
	g.POST("/requests", a.send)
	g.POST("/requests/{id}/accept", a.accept)
	g.DELETE("/{id}", a.remove)
	g.POST("/presence", a.presence)
}

func randomCode() string {
	return security.RandomStringWithAlphabet(friends.CodeLength, friends.CodeAlphabet)
}

// refuse is the one answer for a code or an id that leads nowhere for this
// account, whatever the reason: nobody tells a bad code from a stranger's.
func refuse(e *core.RequestEvent) error {
	return e.JSON(http.StatusNotFound, map[string]string{"error": "refused"})
}

// decode reads a small JSON body with exactly the fields of dst.
func decode(e *core.RequestEvent, dst any) bool {
	raw, err := io.ReadAll(io.LimitReader(e.Request.Body, maxBodyBytes+1))
	if err != nil || len(raw) > maxBodyBytes {
		return false
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	return dec.Decode(dst) == nil && !dec.More()
}

func isMissing(err error) bool { return errors.Is(err, sql.ErrNoRows) }

// cardOf returns the account's card, or nil when it has none yet.
func cardOf(app core.App, userID string) (*core.Record, error) {
	card, err := app.FindFirstRecordByData(friends.CardsCollection, "user", userID)
	if isMissing(err) {
		return nil, nil
	}
	return card, err
}

// ensureCard returns the account's card, with its code drawn the first time.
func (a *api) ensureCard(app core.App, userID string) (*core.Record, error) {
	card, err := cardOf(app, userID)
	if card != nil || err != nil {
		return card, err
	}
	col, err := app.FindCollectionByNameOrId(friends.CardsCollection)
	if err != nil {
		return nil, err
	}
	for range codeAttempts {
		card = core.NewRecord(col)
		card.Set("user", userID)
		card.Set("code", a.newCode())
		if err = app.Save(card); err == nil {
			return card, nil
		}
		// Both are unique: another tab won the race for this account, or the code was taken.
		if existing, findErr := cardOf(app, userID); existing != nil || findErr != nil {
			return existing, findErr
		}
	}
	return nil, err
}

func linksOf(app core.App, userID string) ([]*core.Record, error) {
	return app.FindRecordsByFilter(friends.LinksCollection, "sender = {:me} || receiver = {:me}", "created", maxLinks, 0, dbx.Params{"me": userID})
}

func other(link *core.Record, userID string) string {
	if link.GetString("sender") == userID {
		return link.GetString("receiver")
	}
	return link.GetString("sender")
}

// recordsByUser reads a collection's rows for these accounts, by account.
func recordsByUser(app core.App, collection string, ids []any) (map[string]*core.Record, error) {
	byUser := map[string]*core.Record{}
	if len(ids) == 0 {
		return byUser, nil
	}
	records, err := app.FindAllRecords(collection, dbx.In("user", ids...))
	if err != nil {
		return nil, err
	}
	for _, r := range records {
		byUser[r.GetString("user")] = r
	}
	return byUser, nil
}

func (a *api) overview(e *core.RequestEvent) error {
	me := e.Auth.Id
	card, err := a.ensureCard(e.App, me)
	if err != nil {
		return e.InternalServerError("", err)
	}
	links, err := linksOf(e.App, me)
	if err != nil {
		return e.InternalServerError("", err)
	}
	ids := make([]any, 0, len(links))
	for _, link := range links {
		ids = append(ids, other(link, me))
	}
	cards, err := recordsByUser(e.App, friends.CardsCollection, ids)
	if err != nil {
		return e.InternalServerError("", err)
	}
	profiles, err := recordsByUser(e.App, "profiles", ids)
	if err != nil {
		return e.InternalServerError("", err)
	}
	nickname := func(id string) string {
		if p := profiles[id]; p != nil {
			return p.GetString("nickname")
		}
		return ""
	}

	body := struct {
		Code     string           `json:"code"`
		Friends  []map[string]any `json:"friends"`
		Incoming []map[string]any `json:"incoming"`
		Outgoing []map[string]any `json:"outgoing"`
	}{card.GetString("code"), []map[string]any{}, []map[string]any{}, []map[string]any{}}
	now := a.now()
	for _, link := range links {
		id := other(link, me)
		c := cards[id]
		switch {
		case link.GetBool("accepted"):
			state, room := friends.StateOffline, ""
			if c != nil {
				state, room = friends.State(c.GetDateTime("seen").Time(), c.GetString("room"), now)
			}
			row := map[string]any{"id": link.Id, "nickname": nickname(id), "state": state}
			if room != "" {
				row["room"] = room
			}
			body.Friends = append(body.Friends, row)
		case link.GetString("receiver") == me:
			// Whoever asks shows its nickname to the one it asks, to be recognised.
			body.Incoming = append(body.Incoming, map[string]any{"id": link.Id, "nickname": nickname(id)})
		default:
			// A request not accepted tells its sender nothing but the code it typed.
			code := ""
			if c != nil {
				code = c.GetString("code")
			}
			body.Outgoing = append(body.Outgoing, map[string]any{"id": link.Id, "code": code})
		}
	}
	return e.JSON(http.StatusOK, body)
}

// The counts the caps look at.
func countFriends(app core.App, id string) (int64, error) {
	return app.CountRecords(friends.LinksCollection, dbx.NewExp("accepted = TRUE AND (sender = {:id} OR receiver = {:id})", dbx.Params{"id": id}))
}

func countSent(app core.App, id string) (int64, error) {
	return app.CountRecords(friends.LinksCollection, dbx.NewExp("accepted = FALSE AND sender = {:id}", dbx.Params{"id": id}))
}

func countWaiting(app core.App, id string) (int64, error) {
	return app.CountRecords(friends.LinksCollection, dbx.NewExp("accepted = FALSE AND receiver = {:id}", dbx.Params{"id": id}))
}

// hasRoom fails with `full` when the account is at a cap, or with the query's error.
func hasRoom(app core.App, id string, count func(core.App, string) (int64, error), limit int64, full error) error {
	n, err := count(app, id)
	if err != nil {
		return err
	}
	if n >= limit {
		return full
	}
	return nil
}

func befriend(tx core.App, link *core.Record) error {
	for _, id := range []string{link.GetString("sender"), link.GetString("receiver")} {
		if err := hasRoom(tx, id, countFriends, friends.MaxFriends, errLimit); err != nil {
			return err
		}
	}
	link.Set("accepted", true)
	return tx.Save(link)
}

func (a *api) send(e *core.RequestEvent) error {
	var body struct {
		Code string `json:"code"`
	}
	if !decode(e, &body) || !friends.ValidCode(body.Code) {
		return refuse(e)
	}
	me := e.Auth.Id
	card, err := e.App.FindFirstRecordByData(friends.CardsCollection, "code", body.Code)
	if isMissing(err) {
		return refuse(e)
	}
	if err != nil {
		return e.InternalServerError("", err)
	}
	target := card.GetString("user")
	if target == me {
		return e.JSON(http.StatusBadRequest, map[string]string{"error": "self"})
	}

	status := "pending"
	// One transaction, so concurrent requests cannot pass a cap together.
	err = e.App.RunInTransaction(func(tx core.App) error {
		link, err := tx.FindFirstRecordByData(friends.LinksCollection, "pair", friends.Pair(me, target))
		if err != nil && !isMissing(err) {
			return err
		}
		if link != nil {
			switch {
			case link.GetBool("accepted"):
				status = "friends"
				return nil
			case link.GetString("sender") == me:
				return nil
			}
			// They had already asked: asking back is accepting.
			status = "friends"
			return befriend(tx, link)
		}
		if err := hasRoom(tx, me, countSent, friends.MaxPending, errLimit); err != nil {
			return err
		}
		if err := hasRoom(tx, me, countFriends, friends.MaxFriends, errLimit); err != nil {
			return err
		}
		// A target with no room reads as any code that leads nowhere.
		if err := hasRoom(tx, target, countWaiting, friends.MaxPending, errRefused); err != nil {
			return err
		}
		if err := hasRoom(tx, target, countFriends, friends.MaxFriends, errRefused); err != nil {
			return err
		}
		col, err := tx.FindCollectionByNameOrId(friends.LinksCollection)
		if err != nil {
			return err
		}
		link = core.NewRecord(col)
		link.Load(map[string]any{"pair": friends.Pair(me, target), "sender": me, "receiver": target})
		return tx.Save(link)
	})
	if err != nil {
		return failed(e, err)
	}
	return e.JSON(http.StatusOK, map[string]string{"status": status})
}

func failed(e *core.RequestEvent, err error) error {
	switch {
	case errors.Is(err, errRefused):
		return refuse(e)
	case errors.Is(err, errLimit):
		return e.JSON(http.StatusConflict, map[string]string{"error": "limit"})
	}
	return e.InternalServerError("", err)
}

// linkOf finds a link this account is part of; anything else is errRefused.
func linkOf(app core.App, id, me string) (*core.Record, error) {
	if !validID.MatchString(id) {
		return nil, errRefused
	}
	link, err := app.FindRecordById(friends.LinksCollection, id)
	if isMissing(err) {
		return nil, errRefused
	}
	if err != nil {
		return nil, err
	}
	if link.GetString("sender") != me && link.GetString("receiver") != me {
		return nil, errRefused
	}
	return link, nil
}

func (a *api) accept(e *core.RequestEvent) error {
	me := e.Auth.Id
	err := e.App.RunInTransaction(func(tx core.App) error {
		link, err := linkOf(tx, e.Request.PathValue("id"), me)
		if err != nil {
			return err
		}
		if link.GetString("receiver") != me {
			return errRefused
		}
		if link.GetBool("accepted") {
			return nil
		}
		return befriend(tx, link)
	})
	if err != nil {
		return failed(e, err)
	}
	return e.JSON(http.StatusOK, map[string]string{"status": "friends"})
}

// remove declines a request, cancels one's own or ends a friendship: either
// side, and no trace stays, so the two can start again by code.
func (a *api) remove(e *core.RequestEvent) error {
	link, err := linkOf(e.App, e.Request.PathValue("id"), e.Auth.Id)
	if err != nil {
		return failed(e, err)
	}
	if err := e.App.Delete(link); err != nil {
		return e.InternalServerError("", err)
	}
	return e.NoContent(http.StatusNoContent)
}

func (a *api) presence(e *core.RequestEvent) error {
	var body struct {
		Room *string `json:"room"`
	}
	if !decode(e, &body) {
		return e.BadRequestError("malformed body", nil)
	}
	room := ""
	if body.Room != nil {
		room = *body.Room
		if !friends.ValidRoom(room) {
			return e.BadRequestError("malformed body", nil)
		}
	}
	me := e.Auth.Id
	card, err := cardOf(e.App, me)
	if err != nil {
		return e.InternalServerError("", err)
	}
	if card == nil {
		// Nobody could read it: an account that has not used friends stores nothing.
		n, err := countFriends(e.App, me)
		if err != nil {
			return e.InternalServerError("", err)
		}
		if n == 0 {
			return e.NoContent(http.StatusNoContent)
		}
		if card, err = a.ensureCard(e.App, me); err != nil {
			return e.InternalServerError("", err)
		}
	}
	card.Set("seen", a.now().UTC())
	card.Set("room", room)
	if err := e.App.Save(card); err != nil {
		return e.InternalServerError("", err)
	}
	return e.NoContent(http.StatusNoContent)
}
