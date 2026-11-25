package reports

import (
	"bytes"
	"encoding/json"
	"math"
	"slices"
)

// Performance is the allowlist for diagnostics.performance (issue #71): the
// game's 10-second summary of frame performance, sent only inside a report
// whose technical attachment the player turned on (src/adapters/perf-sampler.ts).
// Every field is a finite number in a range, a boolean or a short enum;
// anything else, an unknown key or a nested object included, fails the whole
// summary. The client's own allowlist (src/app/diagnostics.ts) is defense in
// depth; this is the trust boundary.
type Performance struct {
	Schema         *int          `json:"schema"`
	Scene          *string       `json:"scene"`
	FrameSamples   *float64      `json:"frameSamples"`
	LowSamples     *bool         `json:"lowSamples,omitempty"`
	WindowMs       *float64      `json:"windowMs,omitempty"`
	AgeMs          *float64      `json:"ageMs,omitempty"`
	RefreshHz      *float64      `json:"refreshHz,omitempty"`
	FrameMs        *frameSpread  `json:"frameMs,omitempty"`
	LowFpsRatio    *float64      `json:"lowFpsRatio,omitempty"`
	MissedRatio    *float64      `json:"missedRatio,omitempty"`
	SimMs          *spread       `json:"simMs,omitempty"`
	RenderMs       *spread       `json:"renderMs,omitempty"`
	Enemies        *counts       `json:"enemies,omitempty"`
	VisibleEnemies *counts       `json:"visibleEnemies,omitempty"`
	Bullets        *counts       `json:"bullets,omitempty"`
	ByEnemies      []enemyBucket `json:"byEnemies,omitempty"`
	Canvas         *canvas       `json:"canvas,omitempty"`
}

type frameSpread struct {
	P50 *float64 `json:"p50"`
	P95 *float64 `json:"p95"`
	Max *float64 `json:"max"`
}

type spread struct {
	P50 *float64 `json:"p50"`
	P95 *float64 `json:"p95"`
}

type counts struct {
	Mean *float64 `json:"mean"`
	Peak *float64 `json:"peak"`
}

type enemyBucket struct {
	Enemies *string  `json:"enemies"`
	Frames  *float64 `json:"frames"`
	P50     *float64 `json:"p50,omitempty"`
	P95     *float64 `json:"p95,omitempty"`
}

type canvas struct {
	Width  *float64 `json:"width"`
	Height *float64 `json:"height"`
	Dpr    *float64 `json:"dpr"`
}

// Ranges, generous against the game's own values; a value outside one fails the summary.
const (
	maxSamples   = 10_000
	maxWindowMs  = 60_000
	maxAgeMs     = 7 * 24 * 3600 * 1000
	maxRefreshHz = 1_000
	maxTimeMs    = 60_000
	maxCount     = 10_000
	maxCanvasPx  = 20_000
	maxDpr       = 16
)

// PerformanceScenes and EnemyBuckets are the summary's enums.
var (
	PerformanceScenes = []string{"run", "town"}
	EnemyBuckets      = []string{"0-4", "5-9", "10-19", "20+"}
)

func in(v *float64, lo, hi float64) bool {
	return v != nil && !math.IsNaN(*v) && !math.IsInf(*v, 0) && *v >= lo && *v <= hi
}

func optional(v *float64, lo, hi float64) bool { return v == nil || in(v, lo, hi) }

func whole(v *float64, hi float64) bool { return in(v, 0, hi) && *v == math.Trunc(*v) }

func (p *Performance) valid() bool {
	if p.Schema == nil || *p.Schema != 1 || p.Scene == nil || !slices.Contains(PerformanceScenes, *p.Scene) || !whole(p.FrameSamples, maxSamples) {
		return false
	}
	if p.LowSamples != nil && !*p.LowSamples {
		return false
	}
	if !optional(p.WindowMs, 0, maxWindowMs) || !optional(p.AgeMs, 0, maxAgeMs) || !optional(p.RefreshHz, 1, maxRefreshHz) || !optional(p.LowFpsRatio, 0, 1) || !optional(p.MissedRatio, 0, 1) {
		return false
	}
	if f := p.FrameMs; f != nil && !(in(f.P50, 0, maxTimeMs) && in(f.P95, 0, maxTimeMs) && in(f.Max, 0, maxTimeMs)) {
		return false
	}
	for _, s := range []*spread{p.SimMs, p.RenderMs} {
		if s != nil && !(in(s.P50, 0, maxTimeMs) && in(s.P95, 0, maxTimeMs)) {
			return false
		}
	}
	for _, c := range []*counts{p.Enemies, p.VisibleEnemies, p.Bullets} {
		if c != nil && !(in(c.Mean, 0, maxCount) && whole(c.Peak, maxCount)) {
			return false
		}
	}
	if len(p.ByEnemies) > len(EnemyBuckets) {
		return false
	}
	seen := map[string]bool{}
	for _, b := range p.ByEnemies {
		if b.Enemies == nil || !slices.Contains(EnemyBuckets, *b.Enemies) || seen[*b.Enemies] || !whole(b.Frames, maxSamples) || !optional(b.P50, 0, maxTimeMs) || !optional(b.P95, 0, maxTimeMs) {
			return false
		}
		seen[*b.Enemies] = true
	}
	if c := p.Canvas; c != nil && !(in(c.Width, 0, maxCanvasPx) && in(c.Height, 0, maxCanvasPx) && in(c.Dpr, 0, maxDpr)) {
		return false
	}
	return true
}

// SanitizePerformance answers the summary re-encoded from the allowlist, or
// false when it is not one (the report keeps its other diagnostics).
func SanitizePerformance(raw json.RawMessage) (json.RawMessage, bool) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var p Performance
	if dec.Decode(&p) != nil || dec.More() || !p.valid() {
		return nil, false
	}
	out, err := json.Marshal(p)
	if err != nil {
		return nil, false
	}
	return out, true
}
