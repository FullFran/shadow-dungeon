package setup

import (
	"slices"
	"testing"

	"github.com/pocketbase/pocketbase/tests"

	_ "github.com/fullfran/mazmorra-sombria/server/migrations"
)

func envOf(vars map[string]string) func(string) string {
	return func(key string) string { return vars[key] }
}

func TestFromEnvDefaults(t *testing.T) {
	cfg := FromEnv(envOf(nil))
	if !slices.Equal(cfg.Origins, DefaultOrigins) {
		t.Fatalf("origins = %v, want defaults", cfg.Origins)
	}
	if len(cfg.Providers) != 0 || len(cfg.TrustedProxyHeaders) != 0 || !cfg.RateLimits {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
}

func TestFromEnvProvidersNeedBothCredentials(t *testing.T) {
	cfg := FromEnv(envOf(map[string]string{
		"SD_ALLOWED_ORIGINS":       " https://a.example , ,https://b.example",
		"SD_TRUSTED_PROXY_HEADERS": "X-Real-IP",
		"SD_RATE_LIMITS":           "off",
		"TWITCH_CLIENT_ID":         "tw-id",
		"TWITCH_CLIENT_SECRET":     "tw-secret",
		"DISCORD_CLIENT_ID":        "dc-id", // no secret: stays disabled
		"GOOGLE_CLIENT_SECRET":     "go-secret",
	}))
	if !slices.Equal(cfg.Origins, []string{"https://a.example", "https://b.example"}) {
		t.Fatalf("origins = %v", cfg.Origins)
	}
	if len(cfg.Providers) != 1 || cfg.Providers[0].Name != "twitch" {
		t.Fatalf("providers = %+v, want only twitch", cfg.Providers)
	}
	if cfg.RateLimits || !slices.Equal(cfg.TrustedProxyHeaders, []string{"X-Real-IP"}) {
		t.Fatalf("unexpected config: %+v", cfg)
	}
}

func TestWithOrigins(t *testing.T) {
	origins := []string{"https://a.example", "http://localhost:5173"}
	cases := []struct {
		name string
		args []string
		want []string
	}{
		{"adds to serve", []string{"app", "serve", "--http=0.0.0.0:8090"}, []string{"app", "serve", "--http=0.0.0.0:8090", "--origins=https://a.example,http://localhost:5173"}},
		{"keeps an explicit flag", []string{"app", "serve", "--origins=*"}, []string{"app", "serve", "--origins=*"}},
		{"keeps a split flag", []string{"app", "serve", "--origins", "*"}, []string{"app", "serve", "--origins", "*"}},
		{"ignores other commands", []string{"app", "superuser", "create"}, []string{"app", "superuser", "create"}},
		{"ignores no command", []string{"app"}, []string{"app"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := WithOrigins(tc.args, origins); !slices.Equal(got, tc.want) {
				t.Fatalf("WithOrigins() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestApply(t *testing.T) {
	app, err := tests.NewTestApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()

	cfg := Config{
		Providers:           []Provider{{Name: "discord", ClientID: "id", ClientSecret: "secret"}},
		TrustedProxyHeaders: []string{"X-Real-IP"},
		RateLimits:          true,
	}
	if err := Apply(app, cfg); err != nil {
		t.Fatal(err)
	}

	s := app.Settings()
	if !s.RateLimits.Enabled || len(s.RateLimits.Rules) != len(RateLimitRules) || s.TrustedProxy.Headers[0] != "X-Real-IP" {
		t.Fatalf("settings not applied: %+v %+v", s.RateLimits, s.TrustedProxy)
	}
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	if !users.OAuth2.Enabled || len(users.OAuth2.Providers) != 1 || users.OAuth2.Providers[0].Name != "discord" {
		t.Fatalf("oauth2 not applied: %+v", users.OAuth2)
	}

	// With no providers the collection keeps no auth method and still saves.
	if err := Apply(app, Config{}); err != nil {
		t.Fatal(err)
	}
	users, _ = app.FindCollectionByNameOrId("users")
	if users.OAuth2.Enabled || len(users.OAuth2.Providers) != 0 {
		t.Fatalf("oauth2 should be disabled: %+v", users.OAuth2)
	}
}
