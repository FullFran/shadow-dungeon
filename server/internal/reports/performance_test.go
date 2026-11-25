package reports

import (
	"encoding/json"
	"strings"
	"testing"
)

// A full summary as the game sends it (src/adapters/perf-sampler.ts).
const fullPerformance = `{"schema":1,"scene":"run","frameSamples":540,"windowMs":9984,"ageMs":1200,"refreshHz":60,` +
	`"frameMs":{"p50":16.7,"p95":33.4,"max":120.5},"lowFpsRatio":0.04,"missedRatio":0.12,` +
	`"simMs":{"p50":2.1,"p95":6.3},"renderMs":{"p50":5.2,"p95":11},` +
	`"enemies":{"mean":14.2,"peak":24},"visibleEnemies":{"mean":6.1,"peak":11},"bullets":{"mean":80.3,"peak":212},` +
	`"byEnemies":[{"enemies":"0-4","frames":100,"p50":16.7,"p95":16.7},{"enemies":"5-9","frames":120,"p50":16.7,"p95":17},{"enemies":"10-19","frames":200,"p50":16.7,"p95":33.4},{"enemies":"20+","frames":8}],` +
	`"canvas":{"width":2500,"height":1200,"dpr":3}}`

func TestSanitizePerformanceKeepsAValidSummary(t *testing.T) {
	out, ok := SanitizePerformance(json.RawMessage(fullPerformance))
	if !ok {
		t.Fatal("a valid summary was refused")
	}
	var want, got map[string]any
	_ = json.Unmarshal([]byte(fullPerformance), &want)
	_ = json.Unmarshal(out, &got)
	wantJSON, _ := json.Marshal(want)
	gotJSON, _ := json.Marshal(got)
	if string(wantJSON) != string(gotJSON) {
		t.Fatalf("summary changed:\n got %s\nwant %s", gotJSON, wantJSON)
	}
	// A predictable small budget inside the 16 KiB diagnostics cap.
	if len(out) > 1024 {
		t.Fatalf("full summary is %d bytes", len(out))
	}
}

func TestSanitizePerformanceKeepsAShortOrTownSummary(t *testing.T) {
	for _, raw := range []string{
		`{"schema":1,"scene":"run","frameSamples":0,"lowSamples":true}`,
		`{"schema":1,"scene":"town","frameSamples":300,"windowMs":5000,"ageMs":0,"refreshHz":120,"frameMs":{"p50":8.3,"p95":9,"max":12},"lowFpsRatio":0,"missedRatio":0,"renderMs":{"p50":3,"p95":4}}`,
	} {
		if _, ok := SanitizePerformance(json.RawMessage(raw)); !ok {
			t.Errorf("refused %s", raw)
		}
	}
}

func TestSanitizePerformanceRefusesAnythingOffTheAllowlist(t *testing.T) {
	cases := map[string]string{
		"unknown key":            `{"schema":1,"scene":"run","frameSamples":1,"userAgent":"Mozilla/5.0"}`,
		"token injected":         `{"schema":1,"scene":"run","frameSamples":1,"token":"eyJhbGciOiJIUzI1NiJ9.e30.x"}`,
		"string in a number":     `{"schema":1,"scene":"run","frameSamples":"540"}`,
		"nested object":          `{"schema":1,"scene":"run","frameSamples":1,"frameMs":{"p50":16,"p95":17,"max":{"deep":1}}}`,
		"extra nested key":       `{"schema":1,"scene":"run","frameSamples":1,"enemies":{"mean":1,"peak":2,"ids":["e1"]}}`,
		"raw trace":              `{"schema":1,"scene":"run","frameSamples":3,"frames":[16.7,16.6,33.4]}`,
		"other schema":           `{"schema":2,"scene":"run","frameSamples":1}`,
		"unknown scene":          `{"schema":1,"scene":"https://example.com/?id=1","frameSamples":1}`,
		"missing scene":          `{"schema":1,"frameSamples":1}`,
		"counter too high":       `{"schema":1,"scene":"run","frameSamples":1,"enemies":{"mean":1,"peak":1e9}}`,
		"negative time":          `{"schema":1,"scene":"run","frameSamples":1,"simMs":{"p50":-1,"p95":2}}`,
		"ratio over one":         `{"schema":1,"scene":"run","frameSamples":1,"lowFpsRatio":1.5}`,
		"fractional samples":     `{"schema":1,"scene":"run","frameSamples":1.5}`,
		"lowSamples false":       `{"schema":1,"scene":"run","frameSamples":1,"lowSamples":false}`,
		"unknown bucket":         `{"schema":1,"scene":"run","frameSamples":1,"byEnemies":[{"enemies":"all","frames":3}]}`,
		"repeated bucket":        `{"schema":1,"scene":"run","frameSamples":1,"byEnemies":[{"enemies":"0-4","frames":3},{"enemies":"0-4","frames":3}]}`,
		"too many buckets":       `{"schema":1,"scene":"run","frameSamples":1,"byEnemies":[{"enemies":"0-4","frames":1},{"enemies":"5-9","frames":1},{"enemies":"10-19","frames":1},{"enemies":"20+","frames":1},{"enemies":"20+","frames":1}]}`,
		"peer id in a bucket":    `{"schema":1,"scene":"run","frameSamples":1,"byEnemies":[{"enemies":"0-4","frames":3,"peer":"guestpeer2"}]}`,
		"canvas too big":         `{"schema":1,"scene":"run","frameSamples":1,"canvas":{"width":99999,"height":1,"dpr":1}}`,
		"not an object":          `[1,2,3]`,
		"two values":             `{"schema":1,"scene":"run","frameSamples":1}{"x":1}`,
		"long string as a scene": `{"schema":1,"scene":"` + strings.Repeat("r", 5000) + `","frameSamples":1}`,
	}
	for name, raw := range cases {
		if out, ok := SanitizePerformance(json.RawMessage(raw)); ok {
			t.Errorf("%s: accepted as %s", name, out)
		}
	}
}
