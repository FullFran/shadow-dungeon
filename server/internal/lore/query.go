package lore

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"
)

// Size caps of a context answer.
const (
	DefaultK          = 8
	MaxK              = 25
	MaxSectionChars   = 6000  // total text of the returned sections
	MaxContextChars   = 14000 // the whole plain-text bundle
	maxNeighbours     = 16    // expanded nodes beyond the seeds
	perSeedNeighbours = 4
	maxEdges          = 40
	maxSummary        = 160 // a neighbour's summary in the bundle
	maxSections       = 8
)

// ScoredNode is a node with its relevance to a query.
type ScoredNode struct {
	Node
	Score float64 `json:"score"`
	// Hop is 0 for a node the query matched and 1 for a neighbour.
	Hop int `json:"hop"`
}

// ScoredSection is a section with its relevance to a query.
type ScoredSection struct {
	Doc         string   `json:"doc"`
	Path        string   `json:"path"` // the document's path in the game repo
	HeadingPath []string `json:"heading_path"`
	Lines       [2]int   `json:"lines"`
	Text        string   `json:"text"`
	Score       float64  `json:"score"`
	// Tier is the canon tier the section can carry, from its heading and markers.
	Tier string `json:"tier"`
}

// ContextResult is the answer of the graph-RAG query.
type ContextResult struct {
	Query    string          `json:"query"`
	Nodes    []ScoredNode    `json:"nodes"`
	Edges    []Edge          `json:"edges"`
	Sections []ScoredSection `json:"sections"`
	Context  string          `json:"context"`
}

// Context answers a free-text question: it scores graph nodes, keeps the
// top k that matched, adds their neighbours (1 hop) and the edges between
// them, then picks the bible sections that match the query or mention
// those nodes, within MaxSectionChars.
func (idx *Index) Context(query string, k int) ContextResult {
	k = clampK(k)
	res := ContextResult{Query: query, Nodes: []ScoredNode{}, Edges: []Edge{}, Sections: []ScoredSection{}}
	terms := Terms(query)
	if len(terms) == 0 {
		res.Context, _ = idx.renderContext(res)
		return res
	}

	seeds, relevance := idx.rankNodes(query, terms, k)
	chosen := map[string]float64{} // node id -> weight for section ranking
	for _, s := range seeds {
		res.Nodes = append(res.Nodes, s)
		chosen[s.ID] = s.Score
	}

	// 1 hop: a neighbour scores half its best seed plus half its own
	// relevance to the query. The best seed brings up to maxNeighbours (a
	// question about one entity gets its whole neighbourhood unless it is a
	// hub); every other seed brings at most perSeedNeighbours.
	neigh := map[string]float64{}
	for si, s := range seeds {
		var cands []string
		cand := map[string]float64{}
		for _, ei := range idx.adjacency[s.ID] {
			e := idx.Graph.Edges[ei]
			other := e.To
			if other == s.ID {
				other = e.From
			}
			if _, isSeed := chosen[other]; isSeed {
				continue
			}
			if _, dup := cand[other]; !dup {
				cands = append(cands, other)
			}
			cand[other] = s.Score/2 + relevance[idx.byID[other]]/2
		}
		sort.SliceStable(cands, func(a, b int) bool { return cand[cands[a]] > cand[cands[b]] })
		limit := perSeedNeighbours
		if si == 0 {
			limit = maxNeighbours
		}
		if len(cands) > limit {
			cands = cands[:limit]
		}
		for _, id := range cands {
			neigh[id] = max(neigh[id], cand[id])
		}
	}
	nids := sortedKeys(neigh)
	sort.SliceStable(nids, func(a, b int) bool { return neigh[nids[a]] > neigh[nids[b]] })
	if len(nids) > maxNeighbours {
		nids = nids[:maxNeighbours]
	}
	for _, id := range nids {
		n, _ := idx.NodeByID(id)
		res.Nodes = append(res.Nodes, ScoredNode{Node: n, Score: round(neigh[id]), Hop: 1})
		chosen[id] = neigh[id]
	}

	// Edges with a seed on one end and a returned node on the other.
	seedSet := map[string]bool{}
	for _, s := range seeds {
		seedSet[s.ID] = true
	}
	for _, e := range idx.Graph.Edges {
		_, okF := chosen[e.From]
		_, okT := chosen[e.To]
		if okF && okT && (seedSet[e.From] || seedSet[e.To]) {
			res.Edges = append(res.Edges, e)
			if len(res.Edges) == maxEdges {
				break
			}
		}
	}

	// Contradictions, mysteries and design ideas named by the query or by a
	// matched node ("Choca con el canon actual (C2)") pull in their entry.
	refs := map[string]bool{}
	for _, m := range refRe.FindAllStringSubmatch(strings.ToUpper(query), -1) {
		refs[m[1]] = true
	}
	for _, s := range seeds {
		for _, m := range refRe.FindAllStringSubmatch(s.Summary, -1) {
			refs[m[1]] = true
		}
	}
	res.Sections = idx.rankSections(terms, chosen, seedSet, refs, MaxSectionChars, maxSections)
	res.Context, res.Sections = idx.renderContext(res)
	return res
}

func clampK(k int) int {
	if k <= 0 {
		return DefaultK
	}
	if k > MaxK {
		return MaxK
	}
	return k
}

// rankNodes scores every node with BM25 plus a bonus when the query names
// the node outright, and returns the top k above a relative threshold and
// the scaled relevance of every node. Scores are scaled so that the best
// node scores 1.
func (idx *Index) rankNodes(query string, terms []string, k int) ([]ScoredNode, []float64) {
	raw := idx.nodeBM25.scores(terms)
	nq := Normalize(query)
	best := 0.0
	for _, s := range raw {
		best = max(best, s)
	}
	for i := range raw {
		for _, key := range idx.nodeKeys[i] {
			if containsPhrase(nq, key) {
				raw[i] += best + 1
				break
			}
		}
	}
	order := make([]int, 0, len(raw))
	top := 0.0
	for i, s := range raw {
		if s > 0 {
			order = append(order, i)
			top = max(top, s)
		}
	}
	sort.SliceStable(order, func(a, b int) bool { return raw[order[a]] > raw[order[b]] })
	var out []ScoredNode
	for _, i := range order {
		if len(out) == k || raw[i] < 0.2*top {
			break
		}
		out = append(out, ScoredNode{Node: idx.Graph.Nodes[i], Score: round(raw[i] / top)})
	}
	if top > 0 {
		for i := range raw {
			raw[i] /= top
		}
	}
	return out, raw
}

// rankSections scores sections by BM25 against the query (scaled to 0..1)
// plus the weight of each chosen node they mention (seeds count fully,
// neighbours at a third), then keeps the best ones within the caps.
// A section that defines a referenced C/M/D entry gains 0.8; a section that
// is mostly fenced code (the Mermaid map) keeps a third of its score.
func (idx *Index) rankSections(terms []string, nodes map[string]float64, seeds, refs map[string]bool, charCap, countCap int) []ScoredSection {
	raw := idx.secBM25.scores(terms)
	top := 0.0
	for _, s := range raw {
		top = max(top, s)
	}
	score := make([]float64, len(idx.Sections))
	for i := range idx.Sections {
		if top > 0 {
			score[i] = raw[i] / top
		}
		for id, w := range nodes {
			if !idx.mentions(i, id) {
				continue
			}
			if seeds[id] {
				score[i] += 0.6 * w
			} else {
				score[i] += 0.2 * w
			}
		}
		for ref := range refs {
			if idx.Sections[i].defines[ref] {
				score[i] += 0.8
			}
		}
		if idx.Sections[i].code > 0.5 {
			score[i] /= 3
		}
	}
	return idx.pickSections(score, charCap, countCap)
}

// pickSections returns sections by descending positive score until a cap.
// A section that would overflow the character cap is skipped, not cut.
func (idx *Index) pickSections(score []float64, charCap, countCap int) []ScoredSection {
	order := make([]int, 0, len(score))
	for i, s := range score {
		if s > 0 {
			order = append(order, i)
		}
	}
	sort.SliceStable(order, func(a, b int) bool { return score[order[a]] > score[order[b]] })
	out := []ScoredSection{}
	used := 0
	for _, i := range order {
		if len(out) == countCap {
			break
		}
		s := idx.Sections[i]
		if used+len(s.Text) > charCap {
			continue
		}
		used += len(s.Text)
		out = append(out, ScoredSection{
			Doc: s.Doc, Path: DocPath[s.Doc], HeadingPath: s.HeadingPath, Lines: s.Lines,
			Text: s.Text, Score: round(score[i]), Tier: sectionTier(s),
		})
	}
	return out
}

func (idx *Index) mentions(section int, nodeID string) bool {
	i, ok := idx.byID[nodeID]
	if !ok {
		return false
	}
	for _, key := range idx.nodeKeys[i] {
		if containsPhrase(idx.Sections[section].norm, key) {
			return true
		}
	}
	return false
}

var refRe = regexp.MustCompile(`\b([CMD]\d{1,2})\b`)

var tierMarkRe = regexp.MustCompile(`\[(N|J|B)\]`)

// sectionTier names the canon tier a section can carry. Design ideas are
// "NO CANON AÚN"; the best-practice notes are not lore at all; otherwise the
// tier markers ([N], [J], [B]) present in the text are listed.
func sectionTier(s Section) string {
	if s.Doc == "buenas-practicas" {
		return "buenas prácticas (no es lore)"
	}
	for _, h := range s.HeadingPath {
		if strings.Contains(strings.ToUpper(h), "NO CANON") {
			return "diseño: NO CANON AÚN"
		}
	}
	seen := map[string]bool{}
	for _, m := range tierMarkRe.FindAllStringSubmatch(s.Text, -1) {
		seen[m[1]] = true
	}
	var tiers []string
	for _, t := range []struct{ mark, name string }{{"N", "Núcleo"}, {"J", "En el juego"}, {"B", "Borrador"}} {
		if seen[t.mark] {
			tiers = append(tiers, t.name+" ["+t.mark+"]")
		}
	}
	if len(tiers) == 0 {
		return "sin marca de nivel (ver «Cómo leer este documento»)"
	}
	return strings.Join(tiers, ", ")
}

// NodeResult is a node with its neighbourhood.
type NodeResult struct {
	Node       Node            `json:"node"`
	Neighbours []ScoredNode    `json:"neighbours"` // Hop is the distance (1 or 2)
	Edges      []Edge          `json:"edges"`
	Sections   []ScoredSection `json:"sections"`
}

// NodeDetail returns a node, the nodes within depth hops (1 or 2), the
// edges among them that touch the node or a first neighbour, and the
// sections that mention the node (most mentions first, within the caps).
func (idx *Index) NodeDetail(id string, depth int) (NodeResult, bool) {
	n, ok := idx.NodeByID(id)
	if !ok {
		return NodeResult{}, false
	}
	if depth != 2 {
		depth = 1
	}
	dist := map[string]int{id: 0}
	frontier := []string{id}
	for d := 1; d <= depth; d++ {
		var next []string
		for _, cur := range frontier {
			for _, ei := range idx.adjacency[cur] {
				e := idx.Graph.Edges[ei]
				for _, other := range []string{e.From, e.To} {
					if _, seen := dist[other]; !seen {
						dist[other] = d
						next = append(next, other)
					}
				}
			}
		}
		frontier = next
	}
	res := NodeResult{Node: n, Neighbours: []ScoredNode{}, Edges: []Edge{}, Sections: []ScoredSection{}}
	ids := sortedKeys(dist)
	sort.SliceStable(ids, func(a, b int) bool { return dist[ids[a]] < dist[ids[b]] })
	for _, nid := range ids {
		if nid == id {
			continue
		}
		nn, _ := idx.NodeByID(nid)
		res.Neighbours = append(res.Neighbours, ScoredNode{Node: nn, Hop: dist[nid]})
	}
	for _, e := range idx.Graph.Edges {
		df, okF := dist[e.From]
		dt, okT := dist[e.To]
		if okF && okT && (df < depth || dt < depth) {
			res.Edges = append(res.Edges, e)
		}
	}
	score := make([]float64, len(idx.Sections))
	ni := idx.byID[id]
	for i, s := range idx.Sections {
		for _, key := range idx.nodeKeys[ni] {
			score[i] += float64(strings.Count(" "+s.norm+" ", " "+key+" "))
		}
	}
	res.Sections = idx.pickSections(score, MaxSectionChars, maxSections)
	return res, true
}

// Hit is one autocomplete result.
type Hit struct {
	Kind  string  `json:"kind"` // "node" or "section"
	ID    string  `json:"id,omitempty"`
	Label string  `json:"label"`
	Type  string  `json:"type,omitempty"`
	Doc   string  `json:"doc,omitempty"`
	Lines [2]int  `json:"lines,omitzero"`
	Score float64 `json:"score"`
}

// Search ranks node labels and section headings for autocomplete: every
// query word must start a word of the candidate (the last one may be
// partial). Matches at the start of the label rank first.
func (idx *Index) Search(query string, limit int) []Hit {
	words := strings.Fields(Normalize(query))
	hits := []Hit{}
	if len(words) == 0 {
		return hits
	}
	match := func(text string) float64 {
		nt := Normalize(text)
		tw := strings.Fields(nt)
		for _, w := range words {
			found := false
			for _, t := range tw {
				if strings.HasPrefix(t, w) {
					found = true
					break
				}
			}
			if !found {
				return 0
			}
		}
		s := 1.0
		if strings.HasPrefix(nt, strings.Join(words, " ")) {
			s += 1
		}
		return s + 1/float64(1+len(tw)) // shorter labels first
	}
	for _, n := range idx.Graph.Nodes {
		s := max(match(n.Label), match(strings.ReplaceAll(n.ID, "-", " "))*0.9)
		if s > 0 {
			hits = append(hits, Hit{Kind: "node", ID: n.ID, Label: n.Label, Type: n.Type, Score: round(s)})
		}
	}
	seenHeading := map[string]bool{}
	for _, sec := range idx.Sections {
		h := sec.HeadingPath[len(sec.HeadingPath)-1]
		key := sec.Doc + "\x00" + h
		if seenHeading[key] {
			continue
		}
		if s := match(h); s > 0 {
			seenHeading[key] = true
			hits = append(hits, Hit{Kind: "section", Label: h, Doc: sec.Doc, Lines: sec.Lines, Score: round(s * 0.95)})
		}
	}
	sort.SliceStable(hits, func(a, b int) bool { return hits[a].Score > hits[b].Score })
	if limit > 0 && len(hits) > limit {
		hits = hits[:limit]
	}
	return hits
}

// Meta describes the embedded data.
type Meta struct {
	Version   string         `json:"version"`
	Source    Source         `json:"source"`
	Generated string         `json:"graph_generated"`
	Nodes     int            `json:"nodes"`
	Edges     int            `json:"edges"`
	Sections  int            `json:"sections"`
	ByType    map[string]int `json:"nodes_by_type"`
	ByStatus  map[string]int `json:"nodes_by_status"`
	Docs      []string       `json:"docs"`
}

// Meta returns counts and the data version.
func (idx *Index) Meta() Meta {
	m := Meta{
		Version: idx.Version, Source: idx.Source, Generated: idx.Graph.Generated,
		Nodes: len(idx.Graph.Nodes), Edges: len(idx.Graph.Edges), Sections: len(idx.Sections),
		ByType: map[string]int{}, ByStatus: map[string]int{}, Docs: sortedKeys(Docs),
	}
	for _, n := range idx.Graph.Nodes {
		m.ByType[n.Type]++
		m.ByStatus[n.Status]++
	}
	return m
}

func round(f float64) float64 { return float64(int(f*1000+0.5)) / 1000 }

// statusLabel spells a graph status for the context bundle.
func statusLabel(s string) string {
	if s == "canon" {
		return "canon"
	}
	if s == "diseño" || s == "diseno" {
		return "diseño, NO CANON AÚN"
	}
	return s
}

// renderContext writes the plain-text bundle meant to be pasted into an LLM.
func (idx *Index) renderContext(r ContextResult) (string, []ScoredSection) {
	var b strings.Builder
	fmt.Fprintf(&b, "LORE DE MAZMORRA SOMBRÍA (datos %s, %s@%s). Consulta: «%s».\n", idx.Version, idx.Source.Ref, short(idx.Source.Commit), r.Query)
	b.WriteString("Niveles de canon: [N] Núcleo, [J] En el juego, [B] Borrador (no canon); la sección 10 y los nodos «diseño» son NO CANON AÚN. ")
	b.WriteString("Cn = contradicción conocida, Mn = misterio abierto, Dn = idea de diseño. Fuentes: «ruta:línea» del repo del juego o «i18n:clave» de src/i18n/es.json.\n")
	if len(r.Nodes) == 0 && len(r.Sections) == 0 {
		b.WriteString("\nSin resultados: no está en el lore.\n")
		return b.String(), r.Sections
	}
	if len(r.Nodes) > 0 {
		b.WriteString("\n## Nodos del grafo\n")
		for _, n := range r.Nodes {
			hop, summary := "", n.Summary
			if n.Hop > 0 {
				hop, summary = ", vecino", clip(summary, maxSummary)
			}
			fmt.Fprintf(&b, "- [%s] %s (%s, %s%s): %s [fuentes: %s]\n", n.ID, n.Label, n.Type, statusLabel(n.Status), hop, summary, strings.Join(n.Sources, "; "))
		}
	}
	if len(r.Edges) > 0 {
		b.WriteString("\n## Relaciones\n")
		for _, e := range r.Edges {
			line := fmt.Sprintf("- %s --%s--> %s [fuentes: %s]\n", e.From, e.Relation, e.To, strings.Join(e.Sources, "; "))
			if b.Len()+len(line) > MaxContextChars/2 {
				break
			}
			b.WriteString(line)
		}
	}
	// Sections go in while the bundle stays under MaxContextChars; the ones
	// left out are dropped from the result too, so both stay in step.
	kept := r.Sections[:0]
	for i, s := range r.Sections {
		block := fmt.Sprintf("\n### [%s:%d-%d] %s — nivel: %s\n%s\n", s.Path, s.Lines[0], s.Lines[1], strings.Join(s.HeadingPath[1:], " > "), s.Tier, s.Text)
		if i == 0 {
			b.WriteString("\n## Biblia\n")
		}
		if b.Len()+len(block) > MaxContextChars {
			continue
		}
		b.WriteString(block)
		kept = append(kept, s)
	}
	return b.String(), kept
}

// clip cuts s to at most n bytes on a rune boundary, marking the cut.
func clip(s string, n int) string {
	if len(s) <= n {
		return s
	}
	for n > 0 && !utf8.RuneStart(s[n]) {
		n--
	}
	return s[:n] + "…"
}

func short(commit string) string {
	if len(commit) > 12 {
		return commit[:12]
	}
	return commit
}
