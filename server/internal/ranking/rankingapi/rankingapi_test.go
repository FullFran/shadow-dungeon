package rankingapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	_ "github.com/fullfran/mazmorra-sombria/server/migrations"
)

const board = `[` +
	`{"floor":9,"clockMs":500,"mode":"daily","date":"2026-10-25","seed":3,"species":"zorua","level":14},` +
	`{"floor":12,"clockMs":0,"mode":"free","date":"2026-10-26","seed":4,"species":"zorua","level":15,"difficulty":"hard"}` +
	`]`

// world is a test app with three players: Ana (profile and board), Bea (profile, hard score
// only) and a player with a board but no profile.
func world(t *testing.T) *tests.TestApp {
	t.Helper()
	app, err := tests.NewTestApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(app.Cleanup)
	users, _ := app.FindCollectionByNameOrId("users")
	profiles, _ := app.FindCollectionByNameOrId("profiles")
	saves, _ := app.FindCollectionByNameOrId("saves")
	player := func(email, nickname, data string) *core.Record {
		u := core.NewRecord(users)
		u.SetEmail(email)
		u.SetRandomPassword()
		if err := app.Save(u); err != nil {
			t.Fatal(err)
		}
		if nickname != "" {
			p := core.NewRecord(profiles)
			p.Load(map[string]any{"user": u.Id, "nickname": nickname, "avatarSpecies": "zorua"})
			if err := app.Save(p); err != nil {
				t.Fatal(err)
			}
		}
		s := core.NewRecord(saves)
		s.Load(map[string]any{"user": u.Id, "data": data, "version": 3, "rev": 1})
		if err := app.Save(s); err != nil {
			t.Fatal(err)
		}
		return u
	}
	player("ana@example.com", "Ana", `{"version":3,"coins":77,"secret":"s3cr3t","profile":{"v":1,"board":`+board+`}}`)
	player("bea@example.com", "Bea", `{"version":3,"coins":1,"profile":{"v":1,"board":[{"floor":3,"clockMs":0,"mode":"free","date":"2026-10-24","seed":1,"species":"gastly","level":5,"difficulty":"hard"}]}}`)
	player("ghost@example.com", "", `{"version":3,"coins":1,"profile":{"v":1,"board":[{"floor":40,"clockMs":0,"mode":"free","date":"2026-10-24","seed":1,"species":"gastly","level":5}]}}`)
	player("broken@example.com", "Rota", `{"version":3,"coins":1,"profile":{"v":1,"board":"oops"}}`)
	return app
}

func mux(t *testing.T, app core.App, now func() time.Time) http.Handler {
	t.Helper()
	r, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	register(r, app, now)
	m, err := r.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func get(m http.Handler, url string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
	return rec
}

func TestRankingRoute(t *testing.T) {
	app := world(t)
	m := mux(t, app, time.Now)

	for _, c := range []struct {
		name, url string
		status    int
		body      string
	}{
		{"the default tier is easy", "/api/sd/ranking/sima", 200,
			`{"tier":"easy","entries":[{"rank":1,"nickname":"Ana","avatarSpecies":"zorua","floor":9,"clockMs":500,"species":"zorua","level":14,"mode":"daily","date":"2026-10-25"}]}`},
		{"a tier has its own board", "/api/sd/ranking/sima?tier=hard", 200,
			`{"tier":"hard","entries":[{"rank":1,"nickname":"Ana","avatarSpecies":"zorua","floor":12,"clockMs":0,"species":"zorua","level":15,"mode":"free","date":"2026-10-26"},{"rank":2,"nickname":"Bea","avatarSpecies":"zorua","floor":3,"clockMs":0,"species":"gastly","level":5,"mode":"free","date":"2026-10-24"}]}`},
		{"an empty tier is an empty list", "/api/sd/ranking/sima?tier=nightmare", 200, `{"tier":"nightmare","entries":[]}`},
		{"an unknown tier is 400", "/api/sd/ranking/sima?tier=legend", 400, ""},
	} {
		t.Run(c.name, func(t *testing.T) {
			rec := get(m, c.url)
			if rec.Code != c.status {
				t.Fatalf("status %d, want %d: %s", rec.Code, c.status, rec.Body)
			}
			if c.body == "" {
				return
			}
			if got := strings.TrimSpace(rec.Body.String()); got != c.body {
				t.Fatalf("body\n%s\nwant\n%s", got, c.body)
			}
			if cc := rec.Header().Get("Cache-Control"); cc != "public, max-age=60" {
				t.Errorf("Cache-Control %q", cc)
			}
		})
	}
}

func TestRankingNeverLeaksPrivateData(t *testing.T) {
	app := world(t)
	body := get(mux(t, app, time.Now), "/api/sd/ranking/sima?tier=easy").Body.String()
	for _, private := range []string{"@example.com", "s3cr3t", "coins", "seed", "user", "Rota"} {
		if strings.Contains(body, private) {
			t.Errorf("the ranking shows %q: %s", private, body)
		}
	}
	var shape struct {
		Entries []map[string]any `json:"entries"`
	}
	if err := json.Unmarshal([]byte(body), &shape); err != nil {
		t.Fatal(err)
	}
	for _, e := range shape.Entries {
		if len(e) != 9 {
			t.Errorf("entry has %d fields, want 9: %v", len(e), e)
		}
	}
}

func TestRankingIsCachedBriefly(t *testing.T) {
	app := world(t)
	now := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	m := mux(t, app, func() time.Time { return now })
	before := get(m, "/api/sd/ranking/sima?tier=nightmare").Body.String()

	// A new nightmare score lands in a save.
	users, _ := app.FindCollectionByNameOrId("users")
	profiles, _ := app.FindCollectionByNameOrId("profiles")
	saves, _ := app.FindCollectionByNameOrId("saves")
	u := core.NewRecord(users)
	u.SetRandomPassword()
	if err := app.Save(u); err != nil {
		t.Fatal(err)
	}
	p := core.NewRecord(profiles)
	p.Load(map[string]any{"user": u.Id, "nickname": "Dani"})
	s := core.NewRecord(saves)
	s.Load(map[string]any{"user": u.Id, "version": 3, "rev": 1,
		"data": `{"version":3,"coins":1,"profile":{"board":[{"floor":2,"clockMs":0,"mode":"free","date":"2026-10-28","seed":1,"species":"zorua","level":2,"difficulty":"nightmare"}]}}`})
	if err := app.Save(p); err != nil {
		t.Fatal(err)
	}
	if err := app.Save(s); err != nil {
		t.Fatal(err)
	}

	now = now.Add(cacheFor - time.Second)
	if got := get(m, "/api/sd/ranking/sima?tier=nightmare").Body.String(); got != before {
		t.Fatalf("within the cache window the ranking changed: %s", got)
	}
	now = now.Add(2 * time.Second)
	if got := get(m, "/api/sd/ranking/sima?tier=nightmare").Body.String(); !strings.Contains(got, `"nickname":"Dani"`) {
		t.Fatalf("after the cache window the new score is missing: %s", got)
	}
}
