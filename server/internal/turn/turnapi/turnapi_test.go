package turnapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/tests"
)

const cloudflareAnswer = `{"iceServers":[
	{"urls":["stun:stun.cloudflare.com:3478","stun:stun.cloudflare.com:53"]},
	{"urls":["turn:turn.cloudflare.com:3478?transport=udp","turn:turn.cloudflare.com:53?transport=udp","turns:turn.cloudflare.com:443?transport=tcp"],"username":"u1","credential":"c1"}
]}`

// fakeCloudflare answers like the generator and counts calls; it checks the key and token travel as expected.
func fakeCloudflare(t *testing.T, status int, body string) (*httptest.Server, *atomic.Int32) {
	t.Helper()
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.Method != http.MethodPost || r.URL.Path != "/v1/turn/keys/key-1/credentials/generate-ice-servers" || r.Header.Get("Authorization") != "Bearer token-1" {
			t.Errorf("unexpected request %s %s auth=%q", r.Method, r.URL.Path, r.Header.Get("Authorization"))
		}
		var payload map[string]int64
		_ = json.NewDecoder(r.Body).Decode(&payload)
		if payload["ttl"] != int64(credentialTTL/time.Second) {
			t.Errorf("ttl = %d", payload["ttl"])
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv, &calls
}

func mux(t *testing.T, cfg Config, endpoint string, now func() time.Time) http.Handler {
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
	register(r, cfg, http.DefaultClient, endpoint, now)
	m, err := r.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func get(t *testing.T, m http.Handler) Response {
	t.Helper()
	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/sd/turn", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Errorf("Cache-Control = %q", rec.Header().Get("Cache-Control"))
	}
	if strings.Contains(rec.Body.String(), "token-1") || strings.Contains(rec.Body.String(), "key-1") {
		t.Fatalf("the TURN key leaked: %s", rec.Body.String())
	}
	var out Response
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	return out
}

var key = Config{KeyID: "key-1", APIToken: "token-1"}

func TestHandsOutCloudflareServersWithoutPort53(t *testing.T) {
	cf, _ := fakeCloudflare(t, http.StatusCreated, cloudflareAnswer)
	out := get(t, mux(t, key, cf.URL+"/v1/turn/keys/%s/credentials/generate-ice-servers", time.Now))
	want := []IceServer{
		{URLs: []string{"stun:stun.cloudflare.com:3478"}},
		{URLs: []string{"turn:turn.cloudflare.com:3478?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"}, Username: "u1", Credential: "c1"},
	}
	got, _ := json.Marshal(out.IceServers)
	exp, _ := json.Marshal(want)
	if string(got) != string(exp) {
		t.Fatalf("got %s, want %s", got, exp)
	}
}

func TestReusesOneCredentialForAnHour(t *testing.T) {
	cf, calls := fakeCloudflare(t, http.StatusCreated, cloudflareAnswer)
	clock := time.Date(2026, 10, 29, 12, 0, 0, 0, time.UTC)
	m := mux(t, key, cf.URL+"/v1/turn/keys/%s/credentials/generate-ice-servers", func() time.Time { return clock })
	get(t, m)
	get(t, m)
	clock = clock.Add(reuseFor - time.Second)
	get(t, m)
	if calls.Load() != 1 {
		t.Fatalf("calls = %d, want 1", calls.Load())
	}
	clock = clock.Add(2 * time.Second)
	get(t, m)
	if calls.Load() != 2 {
		t.Fatalf("calls = %d, want 2", calls.Load())
	}
}

func TestNoKeyOrAFailingCloudflareMeansNoRelay(t *testing.T) {
	if out := get(t, mux(t, Config{}, "http://127.0.0.1:1/%s", time.Now)); len(out.IceServers) != 0 {
		t.Fatalf("unconfigured: %v", out.IceServers)
	}
	cf, _ := fakeCloudflare(t, http.StatusUnauthorized, `{"error":"bad token"}`)
	if out := get(t, mux(t, key, cf.URL+"/v1/turn/keys/%s/credentials/generate-ice-servers", time.Now)); len(out.IceServers) != 0 {
		t.Fatalf("failing: %v", out.IceServers)
	}
}

func TestParseTakesASingleObjectAndAStringURL(t *testing.T) {
	got, err := parse([]byte(`{"iceServers":{"urls":"turn:turn.cloudflare.com:3478","username":"u","credential":"c"}}`))
	if err != nil || len(got) != 1 || got[0].URLs[0] != "turn:turn.cloudflare.com:3478" || got[0].Username != "u" {
		t.Fatalf("got %v, %v", got, err)
	}
	if _, err := parse([]byte(`{"iceServers":[{"urls":["http://evil"]}]}`)); err == nil {
		t.Fatal("non-ICE urls accepted")
	}
}

func TestFromEnv(t *testing.T) {
	env := map[string]string{"CF_TURN_KEY_ID": " key-1 ", "CF_TURN_API_TOKEN": "token-1\n"}
	if cfg := FromEnv(func(k string) string { return env[k] }); cfg != key || !cfg.Configured() {
		t.Fatalf("got %+v", cfg)
	}
	if (Config{KeyID: "x"}).Configured() {
		t.Fatal("half a key counts as configured")
	}
}
