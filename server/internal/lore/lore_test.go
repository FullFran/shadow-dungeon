package lore

import (
	"strings"
	"testing"
)

func mustLoad(t *testing.T) *Index {
	t.Helper()
	idx, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	return idx
}

func TestNormalize(t *testing.T) {
	for _, c := range []struct{ in, want string }{
		{"Cráneo", "craneo"},
		{"  «Sombra»   que TIRA… ", "sombra que tira"},
		{"Pingüino-ñandú", "pinguino nandu"},
		{"Senda-del_Disfraz", "senda del disfraz"},
	} {
		if got := Normalize(c.in); got != c.want {
			t.Errorf("Normalize(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestTermsDropStopwordsAndFoldPlurals(t *testing.T) {
	got := strings.Join(Terms("¿Qué sabemos de las sombras del Eclipse?"), " ")
	if got != "sombra eclipse" {
		t.Errorf("Terms = %q", got)
	}
}

func TestIndexBuildsFromEmbeddedData(t *testing.T) {
	idx := mustLoad(t)
	m := idx.Meta()
	if m.Nodes < 100 || m.Edges < 100 || m.Sections < 30 {
		t.Fatalf("index too small: %+v", m)
	}
	if len(m.Version) != 16 || m.Source.Commit == "" {
		t.Fatalf("missing version or source: %+v", m)
	}
	for _, s := range idx.Sections {
		if s.Lines[0] < 1 || s.Lines[1] < s.Lines[0] || len(s.HeadingPath) == 0 || s.Text == "" {
			t.Fatalf("bad section %+v", s)
		}
		if len(s.Text) > maxChunk*2 {
			t.Errorf("section %s:%v is %d chars", s.Doc, s.Lines, len(s.Text))
		}
	}
	// The mermaid block's comment-like lines must not become headings.
	for _, s := range idx.Sections {
		if strings.HasPrefix(s.HeadingPath[len(s.HeadingPath)-1], "graph ") {
			t.Errorf("heading from inside a code fence: %v", s.HeadingPath)
		}
	}
}

func TestSectionLinesPointAtTheText(t *testing.T) {
	idx := mustLoad(t)
	for _, doc := range []string{"lore", "buenas-practicas"} {
		md, _ := idx.DocMarkdown(doc)
		lines := strings.Split(string(md), "\n")
		for _, s := range idx.Sections {
			if s.Doc != doc {
				continue
			}
			last := strings.TrimSpace(lines[s.Lines[1]-1])
			if !strings.HasSuffix(s.Text, last) {
				t.Errorf("%s:%v text does not end with line %d %q", doc, s.Lines, s.Lines[1], last)
			}
		}
	}
}

func ids(nodes []ScoredNode, hop int) map[string]bool {
	out := map[string]bool{}
	for _, n := range nodes {
		if n.Hop == hop {
			out[n.ID] = true
		}
	}
	return out
}

func TestContext(t *testing.T) {
	idx := mustLoad(t)
	for _, c := range []struct {
		name, query  string
		seed         string // a node that must match directly
		sectionHas   string // a word a returned section must contain
		wantNoResult bool
	}{
		{name: "accent-insensitive", query: "craneo", seed: "", sectionHas: "cráneo"},
		{name: "known entity Croagunk", query: "qué sabemos de Croagunk", seed: "croagunk", sectionHas: "Croagunk"},
		{name: "known entity Mimikyu", query: "MIMIKYU", seed: "mimikyu", sectionHas: "Mimikyu"},
		{name: "stopwords only", query: "de la que", wantNoResult: true},
		{name: "unknown", query: "zzzqx", wantNoResult: true},
	} {
		t.Run(c.name, func(t *testing.T) {
			r := idx.Context(c.query, 0)
			if c.wantNoResult {
				if len(r.Nodes)+len(r.Sections) != 0 || !strings.Contains(r.Context, "no está en el lore") {
					t.Fatalf("want no result, got %d nodes %d sections", len(r.Nodes), len(r.Sections))
				}
				return
			}
			if len(r.Nodes) == 0 || len(r.Sections) == 0 {
				t.Fatalf("no nodes or sections for %q", c.query)
			}
			if c.seed != "" {
				if r.Nodes[0].ID != c.seed {
					t.Errorf("top node = %s, want %s", r.Nodes[0].ID, c.seed)
				}
				// Every graph neighbour of the top seed is returned (it is not a hub).
				want := map[string]bool{}
				for _, ei := range idx.adjacency[c.seed] {
					e := idx.Graph.Edges[ei]
					want[e.From], want[e.To] = true, true
				}
				got := ids(r.Nodes, 1)
				for _, n := range r.Nodes {
					got[n.ID] = true
				}
				for id := range want {
					if !got[id] {
						t.Errorf("neighbour %s of %s missing", id, c.seed)
					}
				}
				hasEdge := false
				for _, e := range r.Edges {
					if e.From == c.seed || e.To == c.seed {
						hasEdge = true
					}
				}
				if !hasEdge {
					t.Errorf("no edge of %s returned", c.seed)
				}
			}
			found := false
			for _, s := range r.Sections {
				if strings.Contains(s.Text, c.sectionHas) {
					found = true
				}
			}
			if !found {
				t.Errorf("no section mentions %q", c.sectionHas)
			}
			if !strings.Contains(r.Context, "[fuentes:") || !strings.Contains(r.Context, "nivel:") {
				t.Errorf("context lacks sources or tiers:\n%s", r.Context)
			}
		})
	}
}

func TestContextSizeCaps(t *testing.T) {
	idx := mustLoad(t)
	for _, q := range []string{"sombra", "sombra eclipse sima senda caminante guardián luz", "Sendas Caminantes contradicciones"} {
		for _, k := range []int{0, 8, 25, 1000} {
			r := idx.Context(q, k)
			total := 0
			for _, s := range r.Sections {
				total += len(s.Text)
			}
			if len(r.Context) > MaxContextChars {
				t.Errorf("q=%q k=%d: context %d chars > %d", q, k, len(r.Context), MaxContextChars)
			}
			if total > MaxSectionChars {
				t.Errorf("q=%q k=%d: sections %d chars > %d", q, k, total, MaxSectionChars)
			}
			if seeds := len(ids(r.Nodes, 0)); seeds > MaxK {
				t.Errorf("q=%q k=%d: %d seeds", q, k, seeds)
			}
			if len(r.Nodes) > MaxK+maxNeighbours || len(r.Edges) > maxEdges {
				t.Errorf("q=%q k=%d: %d nodes %d edges", q, k, len(r.Nodes), len(r.Edges))
			}
		}
	}
}

func TestDesignIdeaIsFlaggedWithItsContradiction(t *testing.T) {
	idx := mustLoad(t)
	r := idx.Context("sombra que tira hacia abajo", 8)
	if !strings.Contains(r.Context, "NO CANON AÚN") {
		t.Errorf("design idea not flagged:\n%s", r.Context)
	}
	// The design node says it clashes with C2; the C2 row must come along.
	found := false
	for _, s := range r.Sections {
		if strings.Contains(s.Text, "| C2 |") {
			found = true
		}
	}
	if !found {
		t.Error("contradiction C2 not among the sections")
	}
}

func TestQueryNamingAnEntryPullsItsDefinition(t *testing.T) {
	idx := mustLoad(t)
	r := idx.Context("M1", 8)
	if len(r.Sections) == 0 || !strings.Contains(r.Sections[0].Text, "| M1 |") {
		t.Errorf("M1 definition not first: %+v", r.Sections)
	}
}

func TestNodeDetail(t *testing.T) {
	idx := mustLoad(t)
	if _, ok := idx.NodeDetail("no-such-node", 1); ok {
		t.Fatal("unknown id must not be found")
	}
	one, ok := idx.NodeDetail("croagunk", 1)
	if !ok || one.Node.ID != "croagunk" || len(one.Neighbours) == 0 || len(one.Edges) == 0 || len(one.Sections) == 0 {
		t.Fatalf("croagunk depth 1: %+v", one)
	}
	two, _ := idx.NodeDetail("croagunk", 2)
	if len(two.Neighbours) <= len(one.Neighbours) {
		t.Errorf("depth 2 (%d) not wider than depth 1 (%d)", len(two.Neighbours), len(one.Neighbours))
	}
	for _, n := range one.Neighbours {
		if n.Hop != 1 {
			t.Errorf("depth 1 returned hop %d", n.Hop)
		}
	}
}

func TestSearch(t *testing.T) {
	idx := mustLoad(t)
	for _, c := range []struct{ q, wantID string }{
		{"croag", "croagunk"},
		{"mimi", "mimikyu"},
	} {
		hits := idx.Search(c.q, 10)
		if len(hits) == 0 || hits[0].ID != c.wantID {
			t.Errorf("Search(%q) = %+v, want first %s", c.q, hits, c.wantID)
		}
	}
	hits := idx.Search("contradic", 10)
	found := false
	for _, h := range hits {
		if h.Kind == "section" && strings.Contains(h.Label, "Contradicciones") {
			found = true
		}
	}
	if !found {
		t.Errorf("no section heading hit for 'contradic': %+v", hits)
	}
	if len(idx.Search("", 10)) != 0 {
		t.Error("empty query must return no hits")
	}
}
