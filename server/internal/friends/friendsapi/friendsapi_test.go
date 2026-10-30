package friendsapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/fullfran/mazmorra-sombria/server/internal/friends"
	"github.com/fullfran/mazmorra-sombria/server/internal/setup"
	_ "github.com/fullfran/mazmorra-sombria/server/migrations"
)

type world struct {
	t     *testing.T
	app   *tests.TestApp
	m     http.Handler
	clock time.Time
	code  func() string // nil: the real generator
}

func newWorld(t *testing.T) *world {
	t.Helper()
	app, err := tests.NewTestApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(app.Cleanup)
	w := &world{t: t, app: app, clock: time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC)}
	r, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	register(r, func() time.Time { return w.clock }, func() string {
		if w.code != nil {
			return w.code()
		}
		return randomCode()
	})
	if w.m, err = r.BuildMux(); err != nil {
		t.Fatal(err)
	}
	return w
}

type player struct {
	id, token, email string
}

func (w *world) player(nickname string) player {
	w.t.Helper()
	col, err := w.app.FindCollectionByNameOrId("users")
	if err != nil {
		w.t.Fatal(err)
	}
	u := core.NewRecord(col)
	email := strings.ToLower(nickname) + "@secret.example.com"
	u.SetEmail(email)
	u.SetPassword("a-long-password")
	if err := w.app.Save(u); err != nil {
		w.t.Fatal(err)
	}
	token, err := u.NewAuthToken()
	if err != nil {
		w.t.Fatal(err)
	}
	profiles, err := w.app.FindCollectionByNameOrId("profiles")
	if err != nil {
		w.t.Fatal(err)
	}
	p := core.NewRecord(profiles)
	p.Load(map[string]any{"user": u.Id, "nickname": nickname})
	if err := w.app.Save(p); err != nil {
		w.t.Fatal(err)
	}
	return player{u.Id, token, email}
}

func (w *world) call(method, url, token, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, url, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	w.m.ServeHTTP(rec, req)
	return rec
}

type row struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
	Code     string `json:"code"`
	State    string `json:"state"`
	Room     string `json:"room"`
}

type overview struct {
	Code     string `json:"code"`
	Friends  []row  `json:"friends"`
	Incoming []row  `json:"incoming"`
	Outgoing []row  `json:"outgoing"`
	raw      string
}

func (w *world) overview(p player) overview {
	w.t.Helper()
	rec := w.call(http.MethodGet, "/api/sd/friends", p.token, "")
	if rec.Code != http.StatusOK {
		w.t.Fatalf("overview: %d %s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		w.t.Fatalf("cache-control %q", got)
	}
	var o overview
	if err := json.Unmarshal(rec.Body.Bytes(), &o); err != nil {
		w.t.Fatal(err)
	}
	o.raw = rec.Body.String()
	return o
}

func (w *world) send(from player, code string) *httptest.ResponseRecorder {
	return w.call(http.MethodPost, "/api/sd/friends/requests", from.token, fmt.Sprintf(`{"code":%q}`, code))
}

func (w *world) mustBeFriends(a, b player) {
	w.t.Helper()
	if rec := w.send(a, w.overview(b).Code); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"status":"pending"`) {
		w.t.Fatalf("send: %d %s", rec.Code, rec.Body.String())
	}
	in := w.overview(b).Incoming
	id := in[len(in)-1].ID
	if rec := w.call(http.MethodPost, "/api/sd/friends/requests/"+id+"/accept", b.token, ""); rec.Code != http.StatusOK {
		w.t.Fatalf("accept: %d %s", rec.Code, rec.Body.String())
	}
}

func (w *world) beat(p player, body string) *httptest.ResponseRecorder {
	return w.call(http.MethodPost, "/api/sd/friends/presence", p.token, body)
}

func TestEveryRouteRefusesGuestsAndSuperusers(t *testing.T) {
	w := newWorld(t)
	col, err := w.app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		t.Fatal(err)
	}
	s := core.NewRecord(col)
	s.SetEmail("root@example.com")
	s.SetPassword("a-long-password")
	if err := w.app.Save(s); err != nil {
		t.Fatal(err)
	}
	root, err := s.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct{ method, url, body string }{
		{http.MethodGet, "/api/sd/friends", ""},
		{http.MethodPost, "/api/sd/friends/requests", `{"code":"ACDEFHJK"}`},
		{http.MethodPost, "/api/sd/friends/requests/aaaaaaaaaaaaaaa/accept", ""},
		{http.MethodDelete, "/api/sd/friends/aaaaaaaaaaaaaaa", ""},
		{http.MethodPost, "/api/sd/friends/presence", `{"room":null}`},
	} {
		if rec := w.call(c.method, c.url, "", c.body); rec.Code != http.StatusUnauthorized {
			t.Errorf("guest %s %s: %d", c.method, c.url, rec.Code)
		}
		if rec := w.call(c.method, c.url, root, c.body); rec.Code != http.StatusForbidden {
			t.Errorf("superuser %s %s: %d", c.method, c.url, rec.Code)
		}
	}
	for _, name := range []string{friends.CardsCollection, friends.LinksCollection} {
		if n, err := w.app.CountRecords(name); err != nil || n != 0 {
			t.Fatalf("%s: %d rows, %v", name, n, err)
		}
	}
}

func TestTheRecordsAPIIsClosed(t *testing.T) {
	w := newWorld(t)
	a, b := w.player("Ana"), w.player("Beto")
	w.mustBeFriends(a, b)
	if rec := w.beat(a, `{"room":"K7M3A"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("beat: %d", rec.Code)
	}
	card, err := w.app.FindFirstRecordByData(friends.CardsCollection, "user", a.id)
	if err != nil {
		t.Fatal(err)
	}
	links, err := w.app.FindAllRecords(friends.LinksCollection)
	if err != nil || len(links) != 1 {
		t.Fatalf("%d links, %v", len(links), err)
	}
	for _, c := range []struct{ name, id string }{{friends.CardsCollection, card.Id}, {friends.LinksCollection, links[0].Id}} {
		base := "/api/collections/" + c.name + "/records"
		for _, r := range []struct{ method, url, body string }{
			{http.MethodGet, base, ""},
			{http.MethodGet, base + "/" + c.id, ""},
			{http.MethodPost, base, `{"user":"` + a.id + `","code":"ACDEFHJK"}`},
			{http.MethodPatch, base + "/" + c.id, `{"accepted":false,"room":""}`},
			{http.MethodDelete, base + "/" + c.id, ""},
		} {
			if rec := w.call(r.method, r.url, b.token, r.body); rec.Code != http.StatusForbidden && rec.Code != http.StatusNotFound {
				t.Errorf("%s %s: %d %s", r.method, r.url, rec.Code, rec.Body.String())
			}
		}
	}
	if n, err := w.app.CountRecords(friends.LinksCollection); err != nil || n != 1 {
		t.Fatalf("links %d, %v", n, err)
	}
}

// profiles can be listed by anyone: its filters and expands must not reach into the closed collections.
func TestThePublicProfilesAreNoWayIn(t *testing.T) {
	w := newWorld(t)
	a, b := w.player("Ana"), w.player("Beto")
	w.mustBeFriends(a, b)
	if rec := w.beat(a, `{"room":"K7M3A"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("beat: %d", rec.Code)
	}
	stranger := w.player("Mallory")
	code := w.overview(a).Code
	for _, q := range []string{
		"filter=user.friend_cards_via_user.code='" + code + "'",
		"filter=user.friend_cards_via_user.room='K7M3A'",
		"filter=user.friend_cards_via_user.room~'K'",
		"filter=user.friendships_via_sender.accepted=true",
		"filter=user.friendships_via_receiver.sender='" + b.id + "'",
	} {
		rec := w.call(http.MethodGet, "/api/collections/profiles/records?"+q, stranger.token, "")
		body := rec.Body.String()
		if rec.Code == http.StatusOK && !strings.Contains(body, `"items":[]`) {
			t.Errorf("%s answered rows: %s", q, body)
		}
	}
	rec := w.call(http.MethodGet, "/api/collections/profiles/records?expand=user.friend_cards_via_user,user.friendships_via_sender", stranger.token, "")
	if body := rec.Body.String(); strings.Contains(body, code) || strings.Contains(body, "K7M3A") || strings.Contains(body, `"accepted"`) {
		t.Errorf("expand leaked: %s", body)
	}
}

func TestACodeIsStableReadableAndOneOfItsKind(t *testing.T) {
	w := newWorld(t)
	a, b := w.player("Ana"), w.player("Beto")
	first := w.overview(a).Code
	if !friends.ValidCode(first) {
		t.Fatalf("code %q", first)
	}
	if again := w.overview(a).Code; again != first {
		t.Fatalf("%s then %s", first, again)
	}
	if other := w.overview(b).Code; other == first {
		t.Fatal("two accounts share a code")
	}
}

func TestACodeCollisionDrawsAnother(t *testing.T) {
	w := newWorld(t)
	draws := []string{"ACDEFHJK", "ACDEFHJK", "MNPRTUWX"}
	w.code = func() string {
		next := draws[0]
		draws = draws[1:]
		return next
	}
	a, b := w.player("Ana"), w.player("Beto")
	if got := w.overview(a).Code; got != "ACDEFHJK" {
		t.Fatal(got)
	}
	if got := w.overview(b).Code; got != "MNPRTUWX" {
		t.Fatal(got)
	}
}

func TestSendAcceptRemove(t *testing.T) {
	w := newWorld(t)
	a, b := w.player("Ana"), w.player("Beto")
	code := w.overview(b).Code

	rec := w.send(a, code)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"status":"pending"`) {
		t.Fatalf("send: %d %s", rec.Code, rec.Body.String())
	}
	out := w.overview(a)
	if len(out.Outgoing) != 1 || out.Outgoing[0].Code != code || len(out.Friends) != 0 {
		t.Fatalf("sender sees %s", out.raw)
	}
	in := w.overview(b)
	if len(in.Incoming) != 1 || in.Incoming[0].Nickname != "Ana" || len(in.Friends) != 0 {
		t.Fatalf("receiver sees %s", in.raw)
	}

	// Only the receiver accepts.
	if rec := w.call(http.MethodPost, "/api/sd/friends/requests/"+in.Incoming[0].ID+"/accept", a.token, ""); rec.Code != http.StatusNotFound {
		t.Fatalf("sender accepted: %d", rec.Code)
	}
	if rec := w.call(http.MethodPost, "/api/sd/friends/requests/"+in.Incoming[0].ID+"/accept", b.token, ""); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"status":"friends"`) {
		t.Fatalf("accept: %d %s", rec.Code, rec.Body.String())
	}
	ao, bo := w.overview(a), w.overview(b)
	if len(ao.Friends) != 1 || ao.Friends[0].Nickname != "Beto" || len(ao.Outgoing) != 0 {
		t.Fatalf("a sees %s", ao.raw)
	}
	if len(bo.Friends) != 1 || bo.Friends[0].Nickname != "Ana" || len(bo.Incoming) != 0 {
		t.Fatalf("b sees %s", bo.raw)
	}

	// Either removes it.
	if rec := w.call(http.MethodDelete, "/api/sd/friends/"+bo.Friends[0].ID, a.token, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("remove: %d", rec.Code)
	}
	if ao, bo := w.overview(a), w.overview(b); len(ao.Friends) != 0 || len(bo.Friends) != 0 {
		t.Fatalf("still friends: %s %s", ao.raw, bo.raw)
	}
	if n, err := w.app.CountRecords(friends.LinksCollection); err != nil || n != 0 {
		t.Fatalf("links %d, %v", n, err)
	}
}

func TestDeclineAndCancelLeaveNoTrace(t *testing.T) {
	w := newWorld(t)
	a, b := w.player("Ana"), w.player("Beto")
	code := w.overview(b).Code
	w.send(a, code)
	id := w.overview(b).Incoming[0].ID
	if rec := w.call(http.MethodDelete, "/api/sd/friends/"+id, b.token, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("decline: %d", rec.Code)
	}
	if ao, bo := w.overview(a), w.overview(b); len(ao.Outgoing)+len(ao.Friends)+len(bo.Incoming)+len(bo.Friends) != 0 {
		t.Fatalf("left: %s %s", ao.raw, bo.raw)
	}
	w.send(a, code)
	id = w.overview(a).Outgoing[0].ID
	if rec := w.call(http.MethodDelete, "/api/sd/friends/"+id, a.token, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("cancel: %d", rec.Code)
	}
	if bo := w.overview(b); len(bo.Incoming) != 0 {
		t.Fatalf("still waiting: %s", bo.raw)
	}
}

func TestNoSelfAddNoDuplicates(t *testing.T) {
	w := newWorld(t)
	a, b := w.player("Ana"), w.player("Beto")
	if rec := w.send(a, w.overview(a).Code); rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), `"self"`) {
		t.Fatalf("self: %d %s", rec.Code, rec.Body.String())
	}
	code := w.overview(b).Code
	for range 3 {
		if rec := w.send(a, code); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"status":"pending"`) {
			t.Fatalf("send: %d %s", rec.Code, rec.Body.String())
		}
	}
	if n, err := w.app.CountRecords(friends.LinksCollection); err != nil || n != 1 {
		t.Fatalf("links %d, %v", n, err)
	}
	id := w.overview(b).Incoming[0].ID
	w.call(http.MethodPost, "/api/sd/friends/requests/"+id+"/accept", b.token, "")
	if rec := w.send(a, code); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"status":"friends"`) {
		t.Fatalf("already friends: %d %s", rec.Code, rec.Body.String())
	}
	if n, err := w.app.CountRecords(friends.LinksCollection); err != nil || n != 1 {
		t.Fatalf("links %d, %v", n, err)
	}
}

func TestCrossedRequestsBecomeAFriendship(t *testing.T) {
	w := newWorld(t)
	a, b := w.player("Ana"), w.player("Beto")
	w.send(a, w.overview(b).Code)
	rec := w.send(b, w.overview(a).Code)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"status":"friends"`) {
		t.Fatalf("crossed: %d %s", rec.Code, rec.Body.String())
	}
	if ao, bo := w.overview(a), w.overview(b); len(ao.Friends) != 1 || len(bo.Friends) != 1 || len(ao.Outgoing)+len(bo.Incoming) != 0 {
		t.Fatalf("%s %s", ao.raw, bo.raw)
	}
	if n, err := w.app.CountRecords(friends.LinksCollection); err != nil || n != 1 {
		t.Fatalf("links %d, %v", n, err)
	}
}

// seedLink writes a link directly, past the routes, to fill a cap quickly.
func (w *world) seedLink(sender, receiver string, accepted bool) {
	w.t.Helper()
	col, err := w.app.FindCollectionByNameOrId(friends.LinksCollection)
	if err != nil {
		w.t.Fatal(err)
	}
	r := core.NewRecord(col)
	r.Load(map[string]any{"pair": friends.Pair(sender, receiver), "sender": sender, "receiver": receiver, "accepted": accepted})
	if err := w.app.Save(r); err != nil {
		w.t.Fatal(err)
	}
}

func (w *world) ghost(i int) string {
	w.t.Helper()
	col, err := w.app.FindCollectionByNameOrId("users")
	if err != nil {
		w.t.Fatal(err)
	}
	u := core.NewRecord(col)
	u.SetEmail(fmt.Sprintf("ghost%d@example.com", i))
	u.SetPassword("a-long-password")
	if err := w.app.Save(u); err != nil {
		w.t.Fatal(err)
	}
	return u.Id
}

func TestCaps(t *testing.T) {
	refusal := func(w *world, p player) string {
		rec := w.send(p, "ACDEFHJK") // an unknown code
		if rec.Code != http.StatusNotFound {
			t.Fatalf("unknown: %d", rec.Code)
		}
		return rec.Body.String()
	}

	t.Run("the requests one has sent", func(t *testing.T) {
		w := newWorld(t)
		a, b := w.player("Ana"), w.player("Beto")
		for i := range friends.MaxPending {
			w.seedLink(a.id, w.ghost(i), false)
		}
		if rec := w.send(a, w.overview(b).Code); rec.Code != http.StatusConflict || !strings.Contains(rec.Body.String(), `"limit"`) {
			t.Fatalf("%d %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("a full inbox reads as an unknown code", func(t *testing.T) {
		w := newWorld(t)
		a, b := w.player("Ana"), w.player("Beto")
		for i := range friends.MaxPending {
			w.seedLink(w.ghost(i), b.id, false)
		}
		rec := w.send(a, w.overview(b).Code)
		if rec.Code != http.StatusNotFound || rec.Body.String() != refusal(w, a) {
			t.Fatalf("%d %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("one's friends", func(t *testing.T) {
		w := newWorld(t)
		a, b := w.player("Ana"), w.player("Beto")
		for i := range friends.MaxFriends {
			w.seedLink(a.id, w.ghost(i), true)
		}
		if rec := w.send(a, w.overview(b).Code); rec.Code != http.StatusConflict {
			t.Fatalf("send: %d %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("a target with no room reads as an unknown code", func(t *testing.T) {
		w := newWorld(t)
		a, b := w.player("Ana"), w.player("Beto")
		for i := range friends.MaxFriends {
			w.seedLink(b.id, w.ghost(i), true)
		}
		rec := w.send(a, w.overview(b).Code)
		if rec.Code != http.StatusNotFound || rec.Body.String() != refusal(w, a) {
			t.Fatalf("%d %s", rec.Code, rec.Body.String())
		}
	})

	t.Run("accepting past the cap, either side", func(t *testing.T) {
		w := newWorld(t)
		a, b, c := w.player("Ana"), w.player("Beto"), w.player("Cris")
		w.send(a, w.overview(b).Code)
		w.send(c, w.overview(b).Code)
		for i := range friends.MaxFriends {
			w.seedLink(b.id, w.ghost(i), true)
		}
		for _, in := range w.overview(b).Incoming {
			if rec := w.call(http.MethodPost, "/api/sd/friends/requests/"+in.ID+"/accept", b.token, ""); rec.Code != http.StatusConflict {
				t.Fatalf("accept: %d %s", rec.Code, rec.Body.String())
			}
		}
		if n := len(w.overview(b).Incoming); n != 2 {
			t.Fatalf("the requests should wait: %d", n)
		}
	})

	t.Run("crossed past the cap", func(t *testing.T) {
		w := newWorld(t)
		a, b := w.player("Ana"), w.player("Beto")
		w.send(a, w.overview(b).Code)
		for i := range friends.MaxFriends {
			w.seedLink(b.id, w.ghost(i), true)
		}
		if rec := w.send(b, w.overview(a).Code); rec.Code != http.StatusConflict {
			t.Fatalf("%d %s", rec.Code, rec.Body.String())
		}
		if n := len(w.overview(a).Friends); n != 0 {
			t.Fatalf("became friends past the cap: %d", n)
		}
	})
}

func TestAMalformedOrUnknownCodeGetsTheSameRefusal(t *testing.T) {
	w := newWorld(t)
	a, b := w.player("Ana"), w.player("Beto")
	w.overview(b)
	want := w.send(a, "ACDEFHJK")
	if want.Code != http.StatusNotFound {
		t.Fatalf("unknown: %d", want.Code)
	}
	for _, body := range []string{
		`{"code":"nope"}`, `{"code":"acdefhjk"}`, `{"code":""}`, `{"code":123}`, `{"code":null}`, `{}`, `{`, ``, `[]`, `"ACDEFHJK"`,
		`{"code":"ACDEFHJK","extra":1}`, `{"code":"' OR 1=1 --"}`, `{"code":"` + b.id + `"}`, `{"code":"` + b.email + `"}`, `{"code":"Beto"}`,
		`{"code":"` + strings.Repeat("A", 5000) + `"}`,
	} {
		rec := w.call(http.MethodPost, "/api/sd/friends/requests", a.token, body)
		if rec.Code != want.Code || rec.Body.String() != want.Body.String() {
			t.Errorf("%.40s: %d %s", body, rec.Code, rec.Body.String())
		}
	}
	if n, err := w.app.CountRecords(friends.LinksCollection); err != nil || n != 0 {
		t.Fatalf("links %d, %v", n, err)
	}
}

func TestStateAndRoomReachOnlyAcceptedFriends(t *testing.T) {
	w := newWorld(t)
	a, b, c, d := w.player("Ana"), w.player("Beto"), w.player("Cris"), w.player("Dani")
	w.mustBeFriends(a, b)
	// d has asked a and not been accepted; a has asked c and not been accepted.
	w.send(d, w.overview(a).Code)
	w.send(a, w.overview(c).Code)
	if rec := w.beat(a, `{"room":"K7M3A"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("beat: %d %s", rec.Code, rec.Body.String())
	}
	bo := w.overview(b)
	if bo.Friends[0].State != friends.StateRoom || bo.Friends[0].Room != "K7M3A" {
		t.Fatalf("friend sees %s", bo.raw)
	}
	for _, p := range []player{c, d} {
		o := w.overview(p)
		if strings.Contains(o.raw, "K7M3A") || strings.Contains(o.raw, `"state"`) || len(o.Friends) != 0 {
			t.Fatalf("not a friend, sees %s", o.raw)
		}
	}
	// d asked a, so a sees d's nickname to decide; d learned nothing of a: not the nickname, only the code it typed.
	if o := w.overview(d); strings.Contains(o.raw, "Ana") || o.Outgoing[0].Code != w.overview(a).Code {
		t.Fatalf("sender learned: %s", o.raw)
	}
	// The answer to a send carries nothing of the target.
	rec := w.send(w.player("Eva"), w.overview(a).Code)
	if body := rec.Body.String(); strings.Contains(body, "Ana") || strings.Contains(body, a.id) || strings.Contains(body, "K7M3A") || strings.Contains(body, "online") {
		t.Fatalf("send leaked: %s", body)
	}
	// Removing a friend ends what it can see.
	if rec := w.call(http.MethodDelete, "/api/sd/friends/"+bo.Friends[0].ID, a.token, ""); rec.Code != http.StatusNoContent {
		t.Fatalf("remove: %d", rec.Code)
	}
	if o := w.overview(b); strings.Contains(o.raw, "K7M3A") {
		t.Fatalf("ex-friend sees %s", o.raw)
	}
}

func TestGuessingAnIDGivesNothing(t *testing.T) {
	w := newWorld(t)
	a, b, mallory := w.player("Ana"), w.player("Beto"), w.player("Mallory")
	w.mustBeFriends(a, b)
	id := w.overview(a).Friends[0].ID
	w.send(w.player("Cris"), w.overview(a).Code)
	pending := w.overview(a).Incoming[0].ID
	unknown := w.call(http.MethodDelete, "/api/sd/friends/zzzzzzzzzzzzzzz", mallory.token, "")
	if unknown.Code != http.StatusNotFound {
		t.Fatalf("unknown: %d", unknown.Code)
	}
	for _, url := range []string{"/api/sd/friends/" + id, "/api/sd/friends/" + pending, "/api/sd/friends/not-an-id", "/api/sd/friends/" + a.id} {
		rec := w.call(http.MethodDelete, url, mallory.token, "")
		if rec.Code != unknown.Code || rec.Body.String() != unknown.Body.String() {
			t.Errorf("DELETE %s: %d %s", url, rec.Code, rec.Body.String())
		}
	}
	for _, x := range []string{id, pending, "zzzzzzzzzzzzzzz", "not-an-id"} {
		rec := w.call(http.MethodPost, "/api/sd/friends/requests/"+x+"/accept", mallory.token, "")
		if rec.Code != unknown.Code || rec.Body.String() != unknown.Body.String() {
			t.Errorf("accept %s: %d %s", x, rec.Code, rec.Body.String())
		}
	}
	if n := len(w.overview(a).Friends); n != 1 {
		t.Fatalf("friends %d", n)
	}
	if n := len(w.overview(a).Incoming); n != 1 {
		t.Fatalf("incoming %d", n)
	}
}

func TestNoAnswerCarriesAnEmailOrAUserID(t *testing.T) {
	w := newWorld(t)
	a, b, c := w.player("Ana"), w.player("Beto"), w.player("Cris")
	w.mustBeFriends(a, b)
	w.send(c, w.overview(a).Code)
	w.send(a, w.overview(w.player("Dani")).Code)
	w.beat(a, `{"room":"K7M3A"}`)
	for _, p := range []player{a, b, c} {
		o := w.overview(p)
		for _, other := range []player{a, b, c} {
			if strings.Contains(o.raw, other.email) || strings.Contains(o.raw, other.id) {
				t.Fatalf("%s", o.raw)
			}
		}
		if strings.Contains(o.raw, "@") || strings.Contains(o.raw, "127.0.0") || strings.Contains(o.raw, "seen") {
			t.Fatalf("%s", o.raw)
		}
	}
	// Exactly these fields per row.
	var loose map[string][]map[string]any
	rec := w.call(http.MethodGet, "/api/sd/friends", b.token, "")
	var top map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &top); err != nil {
		t.Fatal(err)
	}
	delete(top, "code")
	raw, _ := json.Marshal(top)
	if err := json.Unmarshal(raw, &loose); err != nil {
		t.Fatal(err)
	}
	f := loose["friends"][0]
	if len(f) != 4 || f["id"] == nil || f["nickname"] != "Ana" || f["state"] != "room" || f["room"] != "K7M3A" {
		t.Fatalf("%v", f)
	}
	if o := w.overview(a); o.Friends[0].Room != "" {
		t.Fatalf("no room to show: %s", o.raw)
	}
}

func TestAFriendWithoutAProfileHasNoName(t *testing.T) {
	w := newWorld(t)
	a, b := w.player("Ana"), w.player("Beto")
	p, err := w.app.FindFirstRecordByData("profiles", "user", b.id)
	if err != nil {
		t.Fatal(err)
	}
	if err := w.app.Delete(p); err != nil {
		t.Fatal(err)
	}
	w.mustBeFriends(a, b)
	if got := w.overview(a).Friends[0]; got.Nickname != "" || got.State != friends.StateOffline {
		t.Fatalf("%+v", got)
	}
}

func TestPresence(t *testing.T) {
	w := newWorld(t)
	a, b := w.player("Ana"), w.player("Beto")
	w.mustBeFriends(a, b)
	state := func() row { return w.overview(b).Friends[0] }

	if got := state(); got.State != friends.StateOffline {
		t.Fatalf("before any beat: %+v", got)
	}
	w.beat(a, `{"room":null}`)
	if got := state(); got.State != friends.StateOnline || got.Room != "" {
		t.Fatalf("online: %+v", got)
	}
	w.clock = w.clock.Add(friends.OnlineWindow)
	if got := state(); got.State != friends.StateOnline {
		t.Fatalf("at the edge: %+v", got)
	}
	w.clock = w.clock.Add(time.Second)
	if got := state(); got.State != friends.StateOffline {
		t.Fatalf("past the edge: %+v", got)
	}
	w.beat(a, `{"room":"K7M3A"}`)
	if got := state(); got.State != friends.StateRoom || got.Room != "K7M3A" {
		t.Fatalf("room: %+v", got)
	}
	// Leaving the room clears it.
	w.beat(a, `{"room":null}`)
	if got := state(); got.State != friends.StateOnline || got.Room != "" {
		t.Fatalf("left: %+v", got)
	}
	card, err := w.app.FindFirstRecordByData(friends.CardsCollection, "user", a.id)
	if err != nil || card.GetString("room") != "" {
		t.Fatalf("stored %v, %v", card, err)
	}
	// A closed tab: the room stops showing with the heartbeat.
	w.beat(a, `{"room":"K7M3A"}`)
	w.clock = w.clock.Add(friends.OnlineWindow + time.Second)
	if got := state(); got.State != friends.StateOffline || got.Room != "" {
		t.Fatalf("stale: %+v", got)
	}
}

func TestABadHeartbeatChangesNothing(t *testing.T) {
	w := newWorld(t)
	a, b := w.player("Ana"), w.player("Beto")
	w.mustBeFriends(a, b)
	w.beat(a, `{"room":"K7M3A"}`)
	w.clock = w.clock.Add(time.Minute)
	for _, body := range []string{`{"room":"K7M2Q"}`, `{"room":"k7m3a"}`, `{"room":"K7M3AA"}`, `{"room":5}`, `{`, ``, `{"room":"K7M3A","x":1}`, `{"room":"` + strings.Repeat("A", 5000) + `"}`} {
		if rec := w.beat(a, body); rec.Code != http.StatusBadRequest {
			t.Errorf("%.30s: %d", body, rec.Code)
		}
	}
	card, err := w.app.FindFirstRecordByData(friends.CardsCollection, "user", a.id)
	if err != nil || card.GetString("room") != "K7M3A" {
		t.Fatalf("%v %v", card, err)
	}
	if !card.GetDateTime("seen").Time().Equal(w.clock.Add(-time.Minute)) {
		t.Fatalf("seen moved: %v", card.GetDateTime("seen"))
	}
}

func TestAnAccountWithoutFriendsStoresNoPresence(t *testing.T) {
	w := newWorld(t)
	a := w.player("Ana")
	if rec := w.beat(a, `{"room":"K7M3A"}`); rec.Code != http.StatusNoContent {
		t.Fatalf("%d", rec.Code)
	}
	if n, err := w.app.CountRecords(friends.CardsCollection); err != nil || n != 0 {
		t.Fatalf("cards %d, %v", n, err)
	}
}

func TestDeletingAnAccountRemovesItsCardAndLinks(t *testing.T) {
	w := newWorld(t)
	a, b, c, d := w.player("Ana"), w.player("Beto"), w.player("Cris"), w.player("Dani")
	w.mustBeFriends(a, b)
	w.send(a, w.overview(c).Code)
	w.send(d, w.overview(a).Code)
	u, err := w.app.FindRecordById("users", a.id)
	if err != nil {
		t.Fatal(err)
	}
	if err := w.app.Delete(u); err != nil {
		t.Fatal(err)
	}
	if n, err := w.app.CountRecords(friends.LinksCollection); err != nil || n != 0 {
		t.Fatalf("links %d, %v", n, err)
	}
	if _, err := w.app.FindFirstRecordByData(friends.CardsCollection, "user", a.id); err == nil {
		t.Fatal("card survived")
	}
	for _, p := range []player{b, c, d} {
		if o := w.overview(p); strings.Contains(o.raw, "Ana") || len(o.Friends)+len(o.Incoming)+len(o.Outgoing) != 0 {
			t.Fatalf("%s", o.raw)
		}
	}
}

// Through the real settings: past the limit a send answers 429, and only sending counts.
func TestSendingIsRateLimited(t *testing.T) {
	w := newWorld(t)
	if err := setup.Apply(w.app, setup.Config{RateLimits: true}); err != nil {
		t.Fatal(err)
	}
	a := w.player("Ana")
	limit := setup.FriendRequestLimit.MaxRequests
	for i := range limit {
		if rec := w.send(a, "ACDEFHJK"); rec.Code != http.StatusNotFound {
			t.Fatalf("send %d: %d", i, rec.Code)
		}
	}
	if rec := w.send(a, "ACDEFHJK"); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("over the limit: %d", rec.Code)
	}
	if rec := w.call(http.MethodGet, "/api/sd/friends", a.token, ""); rec.Code != http.StatusOK {
		t.Fatalf("reading: %d", rec.Code)
	}
	if rec := w.beat(a, `{"room":null}`); rec.Code != http.StatusNoContent {
		t.Fatalf("heartbeat: %d", rec.Code)
	}
}
