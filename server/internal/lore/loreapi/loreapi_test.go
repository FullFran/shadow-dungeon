package loreapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/fullfran/mazmorra-sombria/server/internal/lore"
)

// newMux builds PocketBase's real router (its own /api routes and default
// middlewares included) with the lore routes on top.
func newMux(t *testing.T) http.Handler {
	t.Helper()
	app, err := tests.NewTestApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(app.Cleanup)
	r, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	idx, err := lore.Load()
	if err != nil {
		t.Fatal(err)
	}
	if err := Register(r, idx); err != nil {
		t.Fatal(err)
	}
	mux, err := r.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return mux
}

func get(mux http.Handler, url string, header ...string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, url, nil)
	for i := 0; i+1 < len(header); i += 2 {
		req.Header.Set(header[i], header[i+1])
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func TestRoutes(t *testing.T) {
	mux := newMux(t)
	for _, c := range []struct {
		url    string
		status int
		ctype  string
		body   []string
	}{
		{"/lore", 200, "text/html", []string{"<title>Biblia del lore", `id="como-leer-este-documento"`, `href="/lore/grafo"`, `href="/lore/buenas-practicas"`, "Cómo consultar", "<table>", "language-mermaid", "Índice"}},
		{"/lore/buenas-practicas", 200, "text/html", []string{"Buenas prácticas", `href="/lore"`}},
		{"/lore/grafo", 200, "text/html", []string{"<title>Grafo del lore</title>"}},
		{"/api/lore/context?q=Croagunk&k=8", 200, "application/json", []string{`"query":"Croagunk"`, `"id":"croagunk"`, `"sections":[{`, `"context":"LORE`}},
		{"/api/lore/context?q=craneo", 200, "application/json", []string{"cráneo"}},
		{"/api/lore/context", 400, "application/json", []string{`"status":400`}},
		{"/api/lore/context?q=" + strings.Repeat("a", maxQuery+1), 400, "application/json", nil},
		{"/api/lore/node/croagunk", 200, "application/json", []string{`"node":{"id":"croagunk"`, `"neighbours":[{`, `"edges":[{`}},
		{"/api/lore/node/croagunk?depth=2", 200, "application/json", []string{`"hop":2`}},
		{"/api/lore/node/no-such-node", 404, "application/json", []string{`"status":404`}},
		{"/api/lore/search?q=croa", 200, "application/json", []string{`"hits":[{"kind":"node","id":"croagunk"`}},
		{"/api/lore/search", 400, "application/json", nil},
		{"/api/lore/graph", 200, "application/json", []string{`"nodes"`, `"edges"`}},
		{"/api/lore/doc/lore", 200, "text/markdown", []string{"# Biblia del lore"}},
		{"/api/lore/doc/buenas-practicas", 200, "text/markdown", []string{"# Buenas prácticas"}},
		{"/api/lore/doc/secrets", 404, "application/json", nil},
		{"/api/lore/meta", 200, "application/json", []string{`"version":"`, `"commit":"`, `"nodes":`}},
		{"/api/health", 200, "application/json", nil}, // PocketBase's own routes still answer
	} {
		t.Run(c.url, func(t *testing.T) {
			rec := get(mux, c.url)
			if rec.Code != c.status {
				t.Fatalf("status %d, want %d: %s", rec.Code, c.status, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, c.ctype) {
				t.Errorf("content-type %q, want %s", ct, c.ctype)
			}
			for _, want := range c.body {
				if !strings.Contains(rec.Body.String(), want) {
					t.Errorf("body lacks %q", want)
				}
			}
			isLore := strings.HasPrefix(c.url, "/lore") || strings.HasPrefix(c.url, "/api/lore")
			if isLore && rec.Code == http.StatusOK {
				if rec.Header().Get("ETag") == "" || rec.Header().Get("Cache-Control") == "" {
					t.Error("missing ETag or Cache-Control")
				}
			}
		})
	}
}

func TestETagRevalidates(t *testing.T) {
	mux := newMux(t)
	for _, url := range []string{"/lore", "/api/lore/meta", "/api/lore/context?q=sombra"} {
		first := get(mux, url)
		etag := first.Header().Get("ETag")
		if etag == "" {
			t.Fatalf("%s: no ETag", url)
		}
		if again := get(mux, url, "If-None-Match", etag); again.Code != http.StatusNotModified || again.Body.Len() != 0 {
			t.Errorf("%s: If-None-Match answered %d with %d bytes", url, again.Code, again.Body.Len())
		}
		if other := get(mux, url, "If-None-Match", `"other"`); other.Code != http.StatusOK {
			t.Errorf("%s: stale ETag answered %d", url, other.Code)
		}
	}
}

func TestPagesSendAContentSecurityPolicy(t *testing.T) {
	mux := newMux(t)
	for _, url := range []string{"/lore", "/lore/buenas-practicas", "/lore/grafo"} {
		if csp := get(mux, url).Header().Get("Content-Security-Policy"); !strings.Contains(csp, "default-src 'none'") {
			t.Errorf("%s: CSP %q", url, csp)
		}
	}
}

func TestContextJSONShape(t *testing.T) {
	mux := newMux(t)
	rec := get(mux, "/api/lore/context?q=sombra%20que%20tira&k=3")
	var r struct {
		Query string `json:"query"`
		Nodes []struct {
			ID, Label, Type, Status, Summary string
			Sources                          []string
			Score                            float64
		} `json:"nodes"`
		Edges []struct {
			From, To, Relation string
			Sources            []string
		} `json:"edges"`
		Sections []struct {
			Doc         string   `json:"doc"`
			HeadingPath []string `json:"heading_path"`
			Lines       [2]int   `json:"lines"`
			Text        string   `json:"text"`
			Score       float64  `json:"score"`
		} `json:"sections"`
		Context string `json:"context"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &r); err != nil {
		t.Fatal(err)
	}
	if r.Query != "sombra que tira" || len(r.Nodes) == 0 || len(r.Edges) == 0 || len(r.Sections) == 0 || r.Context == "" {
		t.Fatalf("incomplete answer: %s", rec.Body)
	}
	if r.Sections[0].Lines[0] < 1 || len(r.Sections[0].HeadingPath) == 0 || r.Nodes[0].Sources == nil {
		t.Errorf("section or node fields missing: %+v %+v", r.Sections[0], r.Nodes[0])
	}
}
