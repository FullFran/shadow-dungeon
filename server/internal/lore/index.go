// Package lore indexes the game's lore (the bible, its best practices and
// the lore graph, embedded from data/) and answers grounded queries over it:
// a small graph RAG. This package is pure; the HTTP wiring lives in
// internal/lore/loreapi.
package lore

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/fs"
	"regexp"
	"sort"
	"strings"
)

//go:embed data/lore.md data/buenas-practicas.md data/lore-graph.json data/lore-graph.html data/source.json
var embedded embed.FS

// Docs are the markdown documents that are indexed and served, by short name.
var Docs = map[string]string{
	"lore":             "data/lore.md",
	"buenas-practicas": "data/buenas-practicas.md",
}

// DocPath is the path of each document in the game repo, used in citations.
var DocPath = map[string]string{
	"lore":             "docs/lore/lore.md",
	"buenas-practicas": "docs/lore/buenas-practicas.md",
}

// Node is one lore graph node.
type Node struct {
	ID      string   `json:"id"`
	Label   string   `json:"label"`
	Type    string   `json:"type"`
	Status  string   `json:"status"`
	Summary string   `json:"summary"`
	Sources []string `json:"sources"`
}

// Edge is one lore graph edge.
type Edge struct {
	From     string   `json:"from"`
	To       string   `json:"to"`
	Relation string   `json:"relation"`
	Sources  []string `json:"sources"`
}

// Graph is lore-graph.json.
type Graph struct {
	Generated string `json:"generated"`
	Note      string `json:"note"`
	Nodes     []Node `json:"nodes"`
	Edges     []Edge `json:"edges"`
}

// Section is one chunk of a markdown document: a heading's body, split
// further at line boundaries when it is long.
type Section struct {
	Doc         string          `json:"doc"`
	HeadingPath []string        `json:"heading_path"`
	Lines       [2]int          `json:"lines"` // 1-based, inclusive
	Text        string          `json:"text"`
	norm        string          // normalized text, for mention checks
	code        float64         // share of lines inside fenced code
	defines     map[string]bool // ids defined here: "C2" (table row), "D1" (list item)
}

// Source is what tools/sync-lore.sh recorded.
type Source struct {
	Ref    string `json:"ref"`
	Commit string `json:"commit"`
}

// Index holds the loaded lore and its search structures.
type Index struct {
	Graph    Graph
	Sections []Section
	Source   Source
	Version  string // first 16 hex of the sha256 over the embedded files

	raw       map[string][]byte // embedded file contents by base name
	byID      map[string]int
	adjacency map[string][]int // node id -> indexes of edges touching it
	nodeKeys  [][]string       // normalized phrases that name each node
	nodeBM25  *bm25
	secBM25   *bm25
}

// maxChunk is the target size of a section chunk, in characters.
const maxChunk = 1400

// Load builds the index from the embedded data.
func Load() (*Index, error) { return LoadFS(embedded) }

// LoadFS builds the index from fsys, which must hold the files of data/.
func LoadFS(fsys fs.FS) (*Index, error) {
	idx := &Index{raw: map[string][]byte{}}
	names := []string{"lore.md", "buenas-practicas.md", "lore-graph.json", "lore-graph.html", "source.json"}
	h := sha256.New()
	for _, n := range names {
		b, err := fs.ReadFile(fsys, "data/"+n)
		if err != nil {
			return nil, fmt.Errorf("lore: %w", err)
		}
		idx.raw[n] = b
		fmt.Fprintf(h, "%s\x00%d\x00", n, len(b))
		h.Write(b)
	}
	idx.Version = hex.EncodeToString(h.Sum(nil))[:16]

	if err := json.Unmarshal(idx.raw["lore-graph.json"], &idx.Graph); err != nil {
		return nil, fmt.Errorf("lore: lore-graph.json: %w", err)
	}
	if err := json.Unmarshal(idx.raw["source.json"], &idx.Source); err != nil {
		return nil, fmt.Errorf("lore: source.json: %w", err)
	}

	idx.byID = make(map[string]int, len(idx.Graph.Nodes))
	for i, n := range idx.Graph.Nodes {
		if _, dup := idx.byID[n.ID]; dup {
			return nil, fmt.Errorf("lore: duplicate node id %q", n.ID)
		}
		idx.byID[n.ID] = i
	}
	idx.adjacency = map[string][]int{}
	for i, e := range idx.Graph.Edges {
		if _, ok := idx.byID[e.From]; !ok {
			return nil, fmt.Errorf("lore: edge %d: unknown node %q", i, e.From)
		}
		if _, ok := idx.byID[e.To]; !ok {
			return nil, fmt.Errorf("lore: edge %d: unknown node %q", i, e.To)
		}
		idx.adjacency[e.From] = append(idx.adjacency[e.From], i)
		if e.To != e.From {
			idx.adjacency[e.To] = append(idx.adjacency[e.To], i)
		}
	}

	nodeDocs := make([][]string, len(idx.Graph.Nodes))
	idx.nodeKeys = make([][]string, len(idx.Graph.Nodes))
	for i, n := range idx.Graph.Nodes {
		// The label counts twice: naming a node matters more than its summary.
		nodeDocs[i] = Terms(n.Label + " " + n.Label + " " + strings.ReplaceAll(n.ID, "-", " ") + " " + n.Summary)
		idx.nodeKeys[i] = mentionKeys(n)
	}
	idx.nodeBM25 = newBM25(nodeDocs)

	for _, doc := range []string{"lore", "buenas-practicas"} {
		idx.Sections = append(idx.Sections, splitSections(doc, string(idx.raw[baseName(Docs[doc])]))...)
	}
	secDocs := make([][]string, len(idx.Sections))
	for i := range idx.Sections {
		s := &idx.Sections[i]
		s.norm = Normalize(s.Text)
		secDocs[i] = Terms(strings.Join(s.HeadingPath, " ") + " " + s.Text)
	}
	idx.secBM25 = newBM25(secDocs)
	return idx, nil
}

func baseName(p string) string { return p[strings.LastIndex(p, "/")+1:] }

// Raw returns an embedded file by base name ("lore.md", "lore-graph.html"...).
func (idx *Index) Raw(name string) ([]byte, bool) {
	b, ok := idx.raw[name]
	return b, ok
}

// DocMarkdown returns a document's markdown by short name ("lore").
func (idx *Index) DocMarkdown(doc string) ([]byte, bool) {
	p, ok := Docs[doc]
	if !ok {
		return nil, false
	}
	return idx.Raw(baseName(p))
}

// NodeByID returns a node by id.
func (idx *Index) NodeByID(id string) (Node, bool) {
	i, ok := idx.byID[id]
	if !ok {
		return Node{}, false
	}
	return idx.Graph.Nodes[i], true
}

// mentionKeys are the normalized phrases that, found in a text, mean the
// text talks about the node: the full label, the label before a comma or a
// parenthesis ("Croagunk, el ermitaño" -> "croagunk") and a one-word id.
// Keys shorter than 4 characters are dropped (too ambiguous).
func mentionKeys(n Node) []string {
	cands := []string{n.Label}
	if i := strings.IndexAny(n.Label, ",("); i > 0 {
		cands = append(cands, n.Label[:i])
	}
	if !strings.Contains(n.ID, "-") {
		cands = append(cands, n.ID)
	}
	seen := map[string]bool{}
	var keys []string
	for _, c := range cands {
		k := Normalize(c)
		k = strings.TrimPrefix(k, "la ")
		k = strings.TrimPrefix(k, "el ")
		k = strings.TrimPrefix(k, "los ")
		k = strings.TrimPrefix(k, "las ")
		if len(k) < 4 || seen[k] || stopwords[k] {
			continue
		}
		seen[k] = true
		keys = append(keys, k)
	}
	return keys
}

var headingRe = regexp.MustCompile(`^(#{1,6})\s+(.*?)\s*#*\s*$`)

// splitSections cuts a markdown document at its headings (fenced code is
// not scanned for headings) and splits long sections into chunks of about
// maxChunk characters at line boundaries. A chunk that starts inside a
// table repeats the table's header rows so it still reads as a table.
func splitSections(doc, md string) []Section {
	lines := strings.Split(strings.TrimRight(md, "\n"), "\n")
	type head struct {
		level int
		title string
		line  int // 0-based
	}
	var heads []head
	fence := false
	inCode := make([]bool, len(lines))
	for i, l := range lines {
		t := strings.TrimSpace(l)
		if strings.HasPrefix(t, "```") || strings.HasPrefix(t, "~~~") {
			fence = !fence
			inCode[i] = true
			continue
		}
		if fence {
			inCode[i] = true
			continue
		}
		if m := headingRe.FindStringSubmatch(l); m != nil {
			heads = append(heads, head{level: len(m[1]), title: m[2], line: i})
		}
	}

	var out []Section
	var path []head
	for hi, h := range heads {
		for len(path) > 0 && path[len(path)-1].level >= h.level {
			path = path[:len(path)-1]
		}
		path = append(path, h)
		end := len(lines) - 1
		if hi+1 < len(heads) {
			end = heads[hi+1].line - 1
		}
		titles := make([]string, len(path))
		for i, p := range path {
			titles[i] = p.title
		}
		out = append(out, chunk(doc, titles, lines, h.line, end)...)
	}
	for i := range out {
		s := &out[i]
		n := 0
		for l := s.Lines[0]; l <= s.Lines[1]; l++ {
			if inCode[l-1] {
				n++
			}
		}
		s.code = float64(n) / float64(s.Lines[1]-s.Lines[0]+1)
		s.defines = map[string]bool{}
		for _, m := range definesRe.FindAllStringSubmatch(s.Text, -1) {
			s.defines[m[1]+m[2]] = true
		}
	}
	return out
}

// definesRe finds where an id is defined: a table row "| C2 |" or a list
// item "- **D1." in the bible's mysteries, contradictions and design ideas.
var definesRe = regexp.MustCompile(`(?m)^(?:\|\s*([CMD]\d+)\s*\||-\s+\*\*([CMD]\d+)\.)`)

// chunk packs lines[start..end] (0-based, inclusive) into sections. A
// chunk's Lines cover its own lines; repeated table header rows are extra.
func chunk(doc string, titles []string, lines []string, start, end int) []Section {
	for end > start && strings.TrimSpace(lines[end]) == "" {
		end--
	}
	var out []Section
	var buf []string
	size := 0
	from := start
	var tableHeader []string // header + separator of the table being read
	flush := func(to int) {
		if len(buf) == 0 {
			return
		}
		if text := strings.TrimSpace(strings.Join(buf, "\n")); text != "" {
			out = append(out, Section{
				Doc:         doc,
				HeadingPath: append([]string(nil), titles...),
				Lines:       [2]int{from + 1, to + 1},
				Text:        text,
			})
		}
		buf, size = nil, 0
	}
	for i := start; i <= end; i++ {
		l := lines[i]
		isRow := strings.HasPrefix(strings.TrimSpace(l), "|")
		if !isRow {
			tableHeader = nil
		} else if tableHeader == nil && i+1 <= end && isTableSeparator(lines[i+1]) {
			tableHeader = []string{l, lines[i+1]}
		}
		if size > 0 && size+len(l)+1 > maxChunk {
			flush(i - 1)
			from = i
			if isRow && tableHeader != nil && l != tableHeader[0] && !isTableSeparator(l) {
				buf = append(buf, tableHeader...)
				size = len(tableHeader[0]) + len(tableHeader[1]) + 2
			}
		}
		buf = append(buf, l)
		size += len(l) + 1
	}
	flush(end)
	return out
}

var tableSepRe = regexp.MustCompile(`^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$`)

func isTableSeparator(l string) bool { return tableSepRe.MatchString(l) }

// sortedKeys is a small helper for deterministic output.
func sortedKeys[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
