package reportsapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/fullfran/mazmorra-sombria/server/internal/setup"
	_ "github.com/fullfran/mazmorra-sombria/server/migrations"
)

const clientIP = "203.0.113.7"

var refPattern = regexp.MustCompile(`^SD-[A-Z0-9]{6}$`)

func newApp(t *testing.T) *tests.TestApp {
	t.Helper()
	app, err := tests.NewTestApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(app.Cleanup)
	return app
}

func mux(t *testing.T, app core.App, dailyCap int, now func() time.Time) http.Handler {
	t.Helper()
	r, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	register(r, app, dailyCap, now, testKey)
	m, err := r.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func post(m http.Handler, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sd/reports", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = clientIP + ":5555"
	m.ServeHTTP(rec, req)
	return rec
}

func count(t *testing.T, app core.App) int {
	t.Helper()
	n, err := app.CountRecords(Collection)
	if err != nil {
		t.Fatal(err)
	}
	return int(n)
}

const valid = `{"category":"bug","description":"  The boss froze on floor 3  ","steps":"Enter floor 3","expected":"Fight","observed":"Frozen","version":"1.2.3","device":"Firefox / Linux / no touch","diagnostics":{"fps":58}}`

func TestStoresAValidReportAndAnswersItsRef(t *testing.T) {
	app := newApp(t)
	rec := post(mux(t, app, DailyCap, time.Now), valid)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Ref string `json:"ref"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil || !refPattern.MatchString(out.Ref) {
		t.Fatalf("ref %q (%v)", out.Ref, err)
	}
	r, err := app.FindFirstRecordByData(Collection, "ref", out.Ref)
	if err != nil {
		t.Fatal(err)
	}
	if r.GetString("description") != "The boss froze on floor 3" || r.GetString("category") != "bug" || r.GetString("status") != "new" {
		t.Fatalf("stored %v", r.FieldsData())
	}
	if r.GetString("device") != "Firefox / Linux / no touch" || r.GetString("version") != "1.2.3" || !strings.Contains(r.GetString("diagnostics"), "58") {
		t.Fatalf("stored %v", r.FieldsData())
	}
	if r.GetString("client") != clientHash(testKey, time.Now(), clientIP) || r.GetString("client") == "" {
		t.Fatalf("client = %q", r.GetString("client"))
	}
}

func TestNoIPIsStored(t *testing.T) {
	app := newApp(t)
	if rec := post(mux(t, app, DailyCap, time.Now), valid); rec.Code != http.StatusCreated {
		t.Fatalf("status %d", rec.Code)
	}
	records, err := app.FindAllRecords(Collection)
	if err != nil || len(records) != 1 {
		t.Fatalf("records %d, %v", len(records), err)
	}
	raw, _ := json.Marshal(records[0].FieldsData())
	if strings.Contains(string(raw), clientIP) {
		t.Fatalf("the client IP was stored: %s", raw)
	}
}

func TestRejectsMalformedReports(t *testing.T) {
	long := strings.Repeat("a", MaxDescription+1)
	cases := []struct {
		name, body, field string
		code              int
	}{
		{"missing description", `{"category":"bug"}`, "description", http.StatusBadRequest},
		{"blank description", `{"category":"bug","description":"   "}`, "description", http.StatusBadRequest},
		{"bad category", `{"category":"cheats","description":"x"}`, "category", http.StatusBadRequest},
		{"oversized description", `{"category":"bug","description":"` + long + `"}`, "description", http.StatusBadRequest},
		{"oversized expected", `{"category":"bug","description":"x","expected":"` + strings.Repeat("b", MaxExpected+1) + `"}`, "expected", http.StatusBadRequest},
		{"unknown field", `{"category":"bug","description":"x","email":"a@b.c"}`, "", http.StatusBadRequest},
		{"not json", `hello`, "", http.StatusBadRequest},
		{"diagnostics not an object", `{"category":"bug","description":"x","diagnostics":[1,2]}`, "diagnostics", http.StatusBadRequest},
		{"diagnostics too big", `{"category":"bug","description":"x","diagnostics":{"a":"` + strings.Repeat("d", MaxDiagnosticsBytes) + `"}}`, "diagnostics", http.StatusBadRequest},
		{"body too big", `{"category":"bug","description":"x","steps":"` + strings.Repeat("s", MaxBodyBytes) + `"}`, "", http.StatusRequestEntityTooLarge},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			app := newApp(t)
			rec := post(mux(t, app, DailyCap, time.Now), tt.body)
			if rec.Code != tt.code {
				t.Fatalf("status %d, want %d: %s", rec.Code, tt.code, rec.Body.String())
			}
			if tt.field != "" && !strings.Contains(rec.Body.String(), `"field":"`+tt.field+`"`) {
				t.Fatalf("body %s does not name field %q", rec.Body.String(), tt.field)
			}
			if n := count(t, app); n != 0 {
				t.Fatalf("stored %d records", n)
			}
		})
	}
}

func TestHoneypotAnswersSuccessAndStoresNothing(t *testing.T) {
	app := newApp(t)
	body := strings.Replace(valid, `{"category"`, `{"website":"http://spam.example","category"`, 1)
	rec := post(mux(t, app, DailyCap, time.Now), body)
	if rec.Code != http.StatusCreated || !refPattern.MatchString(strings.Trim(strings.TrimPrefix(strings.TrimSpace(rec.Body.String()), `{"ref":`), `"}`)) {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if n := count(t, app); n != 0 {
		t.Fatalf("honeypot stored %d records", n)
	}
}

func TestDailyCapAnswers503(t *testing.T) {
	app := newApp(t)
	m := mux(t, app, 2, time.Now)
	for i := 0; i < 2; i++ {
		if rec := post(m, valid); rec.Code != http.StatusCreated {
			t.Fatalf("report %d: %d", i, rec.Code)
		}
	}
	rec := post(m, valid)
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "too many reports today") {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if n := count(t, app); n != 2 {
		t.Fatalf("stored %d", n)
	}
	// Tomorrow there is room again.
	tomorrow := func() time.Time { return time.Now().UTC().Add(24 * time.Hour) }
	if rec := post(mux(t, app, 2, tomorrow), valid); rec.Code != http.StatusCreated {
		t.Fatalf("next day: %d %s", rec.Code, rec.Body.String())
	}
}

func TestRateLimitedPerClient(t *testing.T) {
	app := newApp(t)
	app.Settings().RateLimits.Enabled = true
	app.Settings().RateLimits.Rules = setup.RateLimitRules
	m := mux(t, app, DailyCap, time.Now)
	codes := []int{}
	for i := 0; i <= setup.ReportLimit.MaxRequests; i++ {
		codes = append(codes, post(m, valid).Code)
	}
	if setup.ReportLimit.MaxRequests != 5 || codes[4] != http.StatusCreated || codes[5] != http.StatusTooManyRequests {
		t.Fatalf("codes = %v", codes)
	}
}

func TestRecordsAPICannotReadOrWriteReportsAnonymously(t *testing.T) {
	app := newApp(t)
	m := mux(t, app, DailyCap, time.Now)
	if rec := post(m, valid); rec.Code != http.StatusCreated {
		t.Fatalf("seed: %d", rec.Code)
	}
	for _, c := range []struct{ method, url, body string }{
		{http.MethodGet, "/api/collections/reports/records", ""},
		{http.MethodPost, "/api/collections/reports/records", `{"category":"bug","description":"direct"}`},
	} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(c.method, c.url, strings.NewReader(c.body))
		req.Header.Set("Content-Type", "application/json")
		m.ServeHTTP(rec, req)
		if (rec.Code != http.StatusForbidden && rec.Code != http.StatusBadRequest) || strings.Contains(rec.Body.String(), "floor 3") {
			t.Fatalf("%s %s: %d %s", c.method, c.url, rec.Code, rec.Body.String())
		}
	}
	if n := count(t, app); n != 1 {
		t.Fatalf("records = %d", n)
	}
}

func TestRefsAreUnique(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 500; i++ {
		ref := newRef()
		if !refPattern.MatchString(ref) || seen[ref] {
			t.Fatalf("ref %q (dup %v)", ref, seen[ref])
		}
		seen[ref] = true
	}
}

var testKey = []byte("test-key-0123456789abcdef0123456")

// The stored client value must not be reversible from public code: it needs
// the server's secret, and it changes every day (issue #9 review).
func TestClientHashNeedsTheSecretAndRotatesDaily(t *testing.T) {
	day := time.Date(2026, 10, 29, 10, 0, 0, 0, time.UTC)
	ip := "203.0.113.7"
	h := clientHash(testKey, day, ip)
	if len(h) != 24 {
		t.Fatalf("hash %q", h)
	}
	if h != clientHash(testKey, day.Add(5*time.Hour), ip) {
		t.Fatal("not stable within a day")
	}
	if h == clientHash(testKey, day.Add(24*time.Hour), ip) {
		t.Fatal("does not rotate daily")
	}
	if h == clientHash([]byte("another-key-0123456789abcdef0123"), day, ip) {
		t.Fatal("does not depend on the key")
	}
	if h == clientHash(testKey, day, "203.0.113.8") {
		t.Fatal("does not tell clients apart")
	}
}

func TestIPKeyFromEnvOrRandom(t *testing.T) {
	if k := IPKey(func(string) string { return "  secret-from-env  " }); string(k) != "secret-from-env" {
		t.Fatalf("env key = %q", k)
	}
	a, b := IPKey(func(string) string { return "" }), IPKey(func(string) string { return "" })
	if len(a) != 32 || string(a) == string(b) {
		t.Fatal("without the env a fresh random key is expected each start")
	}
}
