package lore

import "math"

// bm25 is an Okapi BM25 scorer over a fixed set of term lists.
type bm25 struct {
	tf     []map[string]int
	length []int
	avg    float64
	df     map[string]int
}

const (
	bm25K1 = 1.2
	bm25B  = 0.75
)

func newBM25(docs [][]string) *bm25 {
	m := &bm25{tf: make([]map[string]int, len(docs)), length: make([]int, len(docs)), df: map[string]int{}}
	total := 0
	for i, terms := range docs {
		tf := map[string]int{}
		for _, t := range terms {
			tf[t]++
		}
		for t := range tf {
			m.df[t]++
		}
		m.tf[i] = tf
		m.length[i] = len(terms)
		total += len(terms)
	}
	if len(docs) > 0 {
		m.avg = float64(total) / float64(len(docs))
	}
	return m
}

func (m *bm25) idf(term string) float64 {
	n := float64(len(m.tf))
	df := float64(m.df[term])
	return math.Log(1 + (n-df+0.5)/(df+0.5))
}

// scores returns the BM25 score of every document for the query terms
// (each distinct term counted once).
func (m *bm25) scores(query []string) []float64 {
	out := make([]float64, len(m.tf))
	seen := map[string]bool{}
	for _, q := range query {
		if seen[q] || m.df[q] == 0 {
			continue
		}
		seen[q] = true
		idf := m.idf(q)
		for i, tf := range m.tf {
			f := float64(tf[q])
			if f == 0 {
				continue
			}
			norm := 1 - bm25B + bm25B*float64(m.length[i])/m.avg
			out[i] += idf * f * (bm25K1 + 1) / (f + bm25K1*norm)
		}
	}
	return out
}
