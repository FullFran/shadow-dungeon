// Package loreapi serves the lore over HTTP: the bible as readable pages
// for people and a small read-only JSON API for grounded LLM context.
// Everything is public on purpose (owner decision 2026-10-27) and reads only
// the embedded lore; it never touches PocketBase collections.
package loreapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"

	"github.com/fullfran/mazmorra-sombria/server/internal/lore"
)

// Cache lifetimes. The data only changes with a deploy, and the ETag lets
// clients revalidate cheaply.
const (
	cachePage  = "public, max-age=300"
	cacheQuery = "public, max-age=60"
	maxQuery   = 300 // characters of q
	searchHits = 12
)

// CSP for the rendered pages: inline styles and scripts, plus the pinned
// Mermaid build from cdnjs. The graph viewer is fully self-contained.
const (
	cspPage  = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
	cspGraph = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"
)

type api struct {
	idx   *lore.Index
	pages map[string][]byte // rendered HTML by doc name
	graph []byte
	meta  []byte
}

// Register adds the lore routes to r. The pages are rendered once, here.
func Register(r *router.Router[*core.RequestEvent], idx *lore.Index) error {
	a := &api{idx: idx, pages: map[string][]byte{}}
	for _, doc := range []string{"lore", "buenas-practicas"} {
		page, err := renderPage(idx, doc)
		if err != nil {
			return err
		}
		a.pages[doc] = page
	}
	a.graph, _ = idx.Raw("lore-graph.json")
	meta, err := json.Marshal(idx.Meta())
	if err != nil {
		return err
	}
	a.meta = meta

	r.GET("/lore", a.page("lore"))
	r.GET("/lore/buenas-practicas", a.page("buenas-practicas"))
	r.GET("/lore/grafo", a.graphPage)
	r.GET("/api/lore/context", a.context)
	r.GET("/api/lore/node/{id}", a.node)
	r.GET("/api/lore/search", a.search)
	r.GET("/api/lore/graph", func(e *core.RequestEvent) error {
		return send(e, "application/json; charset=utf-8", cachePage, a.graph)
	})
	r.GET("/api/lore/doc/{doc}", a.doc)
	r.GET("/api/lore/meta", func(e *core.RequestEvent) error {
		return send(e, "application/json; charset=utf-8", cachePage, a.meta)
	})
	return nil
}

func (a *api) page(doc string) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		e.Response.Header().Set("Content-Security-Policy", cspPage)
		return send(e, "text/html; charset=utf-8", cachePage, a.pages[doc])
	}
}

func (a *api) graphPage(e *core.RequestEvent) error {
	b, _ := a.idx.Raw("lore-graph.html")
	e.Response.Header().Set("Content-Security-Policy", cspGraph)
	return send(e, "text/html; charset=utf-8", cachePage, b)
}

func (a *api) doc(e *core.RequestEvent) error {
	b, ok := a.idx.DocMarkdown(e.Request.PathValue("doc"))
	if !ok {
		return e.NotFoundError("Unknown lore document (lore, buenas-practicas).", nil)
	}
	return send(e, "text/markdown; charset=utf-8", cachePage, b)
}

func (a *api) context(e *core.RequestEvent) error {
	q, err := query(e)
	if err != nil {
		return err
	}
	k, _ := strconv.Atoi(e.Request.URL.Query().Get("k"))
	return sendJSON(e, a.idx.Context(q, k))
}

func (a *api) node(e *core.RequestEvent) error {
	depth, _ := strconv.Atoi(e.Request.URL.Query().Get("depth"))
	res, ok := a.idx.NodeDetail(e.Request.PathValue("id"), depth)
	if !ok {
		return e.NotFoundError("Unknown lore node.", nil)
	}
	return sendJSON(e, res)
}

func (a *api) search(e *core.RequestEvent) error {
	q, err := query(e)
	if err != nil {
		return err
	}
	return sendJSON(e, map[string]any{"query": q, "hits": a.idx.Search(q, searchHits)})
}

func query(e *core.RequestEvent) (string, error) {
	q := strings.TrimSpace(e.Request.URL.Query().Get("q"))
	if q == "" {
		return "", e.BadRequestError("Missing q.", nil)
	}
	if len([]rune(q)) > maxQuery {
		return "", e.BadRequestError("q is too long.", nil)
	}
	return q, nil
}

func sendJSON(e *core.RequestEvent, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return send(e, "application/json; charset=utf-8", cacheQuery, b)
}

// send writes body with an ETag and Cache-Control, answering 304 when the
// client already has this exact body.
func send(e *core.RequestEvent, contentType, cache string, body []byte) error {
	sum := sha256.Sum256(body)
	etag := `"` + hex.EncodeToString(sum[:8]) + `"`
	h := e.Response.Header()
	h.Set("ETag", etag)
	h.Set("Cache-Control", cache)
	if etagMatches(e.Request.Header.Get("If-None-Match"), etag) {
		return e.NoContent(http.StatusNotModified)
	}
	return e.Blob(http.StatusOK, contentType, body)
}

func etagMatches(header, etag string) bool {
	for _, t := range strings.Split(header, ",") {
		t = strings.TrimPrefix(strings.TrimSpace(t), "W/")
		if t == etag || t == "*" {
			return true
		}
	}
	return false
}
