// Package turnapi hands the game short-lived TURN credentials from Cloudflare
// Realtime, so co-op players whose browsers cannot reach each other directly
// (strict NAT, mobile data, privacy settings) are relayed instead of never
// connecting. The long-lived TURN key stays on the server: the route answers
// only the ICE servers Cloudflare generated for a few hours.
package turnapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// credentialTTL is how long Cloudflare keeps a generated credential valid
// (its maximum is 48 h).
const credentialTTL = 6 * time.Hour

// reuseFor is how long one generated credential is handed out before a new
// one is asked for: every client gets at least credentialTTL-reuseFor of it.
const reuseFor = time.Hour

// Endpoint is Cloudflare's credential generator; %s is the TURN key id.
const Endpoint = "https://rtc.live.cloudflare.com/v1/turn/keys/%s/credentials/generate-ice-servers"

// Config is the TURN key from the Cloudflare dashboard (Realtime > TURN).
type Config struct {
	KeyID    string
	APIToken string
}

// Configured reports whether both halves of the key are set.
func (c Config) Configured() bool { return c.KeyID != "" && c.APIToken != "" }

// FromEnv reads CF_TURN_KEY_ID and CF_TURN_API_TOKEN through getenv.
func FromEnv(getenv func(string) string) Config {
	return Config{KeyID: strings.TrimSpace(getenv("CF_TURN_KEY_ID")), APIToken: strings.TrimSpace(getenv("CF_TURN_API_TOKEN"))}
}

// IceServer is one RTCIceServer entry as the browser takes it.
type IceServer struct {
	URLs       []string `json:"urls"`
	Username   string   `json:"username,omitempty"`
	Credential string   `json:"credential,omitempty"`
}

// Response is the route's JSON body; empty iceServers means "no relay, go direct".
type Response struct {
	IceServers []IceServer `json:"iceServers"`
}

type api struct {
	cfg      Config
	client   *http.Client
	endpoint string
	now      func() time.Time

	mu   sync.Mutex
	body []byte
	at   time.Time
}

// Register adds `GET /api/sd/turn` to r.
func Register(r *router.Router[*core.RequestEvent], cfg Config) {
	register(r, cfg, &http.Client{Timeout: 5 * time.Second}, Endpoint, time.Now)
}

func register(r *router.Router[*core.RequestEvent], cfg Config, client *http.Client, endpoint string, now func() time.Time) {
	a := &api{cfg: cfg, client: client, endpoint: endpoint, now: now}
	r.GET("/api/sd/turn", a.turn)
}

func (a *api) turn(e *core.RequestEvent) error {
	e.Response.Header().Set("Cache-Control", "no-store")
	if !a.cfg.Configured() {
		return e.JSON(http.StatusOK, Response{IceServers: []IceServer{}})
	}
	body, err := a.credentials(e.Request.Context())
	if err != nil {
		e.App.Logger().Warn("turn credentials unavailable", "error", err)
		return e.JSON(http.StatusOK, Response{IceServers: []IceServer{}})
	}
	return e.Blob(http.StatusOK, "application/json; charset=utf-8", body)
}

// credentials is the current credential as JSON, generated again once it has
// been handed out for reuseFor. The lock is held while generating, so a burst
// of players opening rooms asks Cloudflare once.
func (a *api) credentials(ctx context.Context) ([]byte, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.body != nil && a.now().Sub(a.at) < reuseFor {
		return a.body, nil
	}
	servers, err := a.generate(ctx)
	if err != nil {
		return nil, err
	}
	body, err := json.Marshal(Response{IceServers: servers})
	if err != nil {
		return nil, err
	}
	a.body, a.at = body, a.now()
	return body, nil
}

func (a *api) generate(ctx context.Context) ([]IceServer, error) {
	payload, _ := json.Marshal(map[string]int64{"ttl": int64(credentialTTL / time.Second)})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf(a.endpoint, a.cfg.KeyID), bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+a.cfg.APIToken)
	req.Header.Set("Content-Type", "application/json")
	res, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	if err != nil {
		return nil, err
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return nil, fmt.Errorf("cloudflare answered %d", res.StatusCode)
	}
	return parse(raw)
}

// parse reads Cloudflare's answer, whose iceServers is a list or a single
// object, and keeps only stun:/turn:/turns: URLs off port 53 (browsers block
// it, and Firefox then waits on it before trying the others).
func parse(raw []byte) ([]IceServer, error) {
	var outer struct {
		IceServers json.RawMessage `json:"iceServers"`
	}
	if err := json.Unmarshal(raw, &outer); err != nil {
		return nil, err
	}
	var list []rawServer
	if err := json.Unmarshal(outer.IceServers, &list); err != nil {
		var one rawServer
		if err := json.Unmarshal(outer.IceServers, &one); err != nil {
			return nil, fmt.Errorf("unexpected iceServers: %w", err)
		}
		list = []rawServer{one}
	}
	out := []IceServer{}
	for _, s := range list {
		urls := []string{}
		for _, u := range s.urls() {
			if usable(u) {
				urls = append(urls, u)
			}
		}
		if len(urls) > 0 {
			out = append(out, IceServer{URLs: urls, Username: s.Username, Credential: s.Credential})
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no usable ice servers")
	}
	return out, nil
}

type rawServer struct {
	URLs       json.RawMessage `json:"urls"`
	Username   string          `json:"username"`
	Credential string          `json:"credential"`
}

func (s rawServer) urls() []string {
	var list []string
	if json.Unmarshal(s.URLs, &list) == nil {
		return list
	}
	var one string
	if json.Unmarshal(s.URLs, &one) == nil {
		return []string{one}
	}
	return nil
}

func usable(u string) bool {
	if !strings.HasPrefix(u, "stun:") && !strings.HasPrefix(u, "turn:") && !strings.HasPrefix(u, "turns:") {
		return false
	}
	host := u
	if i := strings.IndexByte(host, '?'); i >= 0 {
		host = host[:i]
	}
	return !strings.HasSuffix(host, ":53")
}
