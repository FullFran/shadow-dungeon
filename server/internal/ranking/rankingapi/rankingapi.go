// Package rankingapi serves the Sima del Eclipse global ranking, derived
// from the cloud saves by package ranking. It is public and read-only: the
// route reads `saves` and `profiles` with app-level access (the collection
// rules stay owner-only) and answers only the public fields of
// ranking.Entry, never raw save data, emails or user ids.
package rankingapi

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/types"

	"github.com/fullfran/mazmorra-sombria/server/internal/ranking"
)

// cacheFor is how long a tier's ranking is reused before the saves are read
// again; the same lifetime goes to clients in Cache-Control.
const cacheFor = 60 * time.Second

const cacheControl = "public, max-age=60"

// Response is the route's JSON body.
type Response struct {
	Tier    string          `json:"tier"`
	Entries []ranking.Entry `json:"entries"`
}

type cached struct {
	body []byte
	at   time.Time
}

type api struct {
	app core.App
	now func() time.Time

	mu    sync.Mutex
	cache map[string]cached
}

// Register adds `GET /api/sd/ranking/sima?tier=<difficulty>` to r.
func Register(r *router.Router[*core.RequestEvent], app core.App) {
	register(r, app, time.Now)
}

func register(r *router.Router[*core.RequestEvent], app core.App, now func() time.Time) {
	a := &api{app: app, now: now, cache: map[string]cached{}}
	r.GET("/api/sd/ranking/sima", a.sima)
}

func (a *api) sima(e *core.RequestEvent) error {
	tier := e.Request.URL.Query().Get("tier")
	if tier == "" {
		tier = ranking.DefaultTier
	}
	if !ranking.IsTier(tier) {
		return e.BadRequestError("Unknown tier.", nil)
	}
	body, err := a.body(tier)
	if err != nil {
		return e.InternalServerError("The ranking is unavailable.", err)
	}
	e.Response.Header().Set("Cache-Control", cacheControl)
	return e.Blob(http.StatusOK, "application/json; charset=utf-8", body)
}

// body is tier's ranking as JSON, from the cache while it is fresh. The lock
// is held while building, so a burst of requests reads the saves once.
func (a *api) body(tier string) ([]byte, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if c, ok := a.cache[tier]; ok && a.now().Sub(c.at) < cacheFor {
		return c.body, nil
	}
	entries, err := a.build(tier)
	if err != nil {
		return nil, err
	}
	body, err := json.Marshal(Response{Tier: tier, Entries: entries})
	if err != nil {
		return nil, err
	}
	a.cache[tier] = cached{body: body, at: a.now()}
	return body, nil
}

func (a *api) build(tier string) ([]ranking.Entry, error) {
	profileRecords, err := a.app.FindAllRecords("profiles")
	if err != nil {
		return nil, err
	}
	profiles := make(map[string]ranking.Profile, len(profileRecords))
	for _, p := range profileRecords {
		profiles[p.GetString("user")] = ranking.Profile{Nickname: p.GetString("nickname"), AvatarSpecies: p.GetString("avatarSpecies")}
	}
	saveRecords, err := a.app.FindAllRecords("saves")
	if err != nil {
		return nil, err
	}
	saves := make([]ranking.Save, 0, len(saveRecords))
	for _, s := range saveRecords {
		var data []byte
		if raw, ok := s.Get("data").(types.JSONRaw); ok {
			data = raw
		} else {
			data = []byte(s.GetString("data"))
		}
		saves = append(saves, ranking.Save{User: s.GetString("user"), Data: data})
	}
	entries := ranking.Build(saves, profiles, tier)
	if entries == nil {
		entries = []ranking.Entry{}
	}
	return entries, nil
}
