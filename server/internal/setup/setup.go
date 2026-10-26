// Package setup reads the environment and applies it to PocketBase at
// startup: CORS origins, OAuth2 providers, rate limits and proxy headers.
// Email + password sign-in is schema (migrations), not environment.
// The environment is the source of truth; changes made in the dashboard to
// these settings are overwritten on the next start.
package setup

import (
	"os"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// DefaultOrigins are the CORS origins used when SD_ALLOWED_ORIGINS is unset.
var DefaultOrigins = []string{"https://www.fullfran.com", "http://localhost:5173"}

// Provider is one OAuth2 provider, enabled when both credentials are set.
type Provider struct {
	Name         string // PocketBase provider name
	ClientID     string
	ClientSecret string
}

// Config is everything the server reads from its environment.
type Config struct {
	Origins             []string
	Providers           []Provider
	TrustedProxyHeaders []string
	RateLimits          bool
}

// FromEnv reads the configuration through getenv (os.Getenv in production).
func FromEnv(getenv func(string) string) Config {
	cfg := Config{
		Origins:             splitList(getenv("SD_ALLOWED_ORIGINS")),
		TrustedProxyHeaders: splitList(getenv("SD_TRUSTED_PROXY_HEADERS")),
		RateLimits:          getenv("SD_RATE_LIMITS") != "off",
	}
	if len(cfg.Origins) == 0 {
		cfg.Origins = DefaultOrigins
	}

	for _, name := range []string{"twitch", "discord", "google"} {
		prefix := strings.ToUpper(name)
		p := Provider{Name: name, ClientID: getenv(prefix + "_CLIENT_ID"), ClientSecret: getenv(prefix + "_CLIENT_SECRET")}
		if p.ClientID != "" && p.ClientSecret != "" {
			cfg.Providers = append(cfg.Providers, p)
		}
	}
	return cfg
}

// WithOrigins returns the process arguments with --origins added to `serve`
// unless it is already there: PocketBase only reads CORS origins from that flag.
func WithOrigins(args []string, origins []string) []string {
	if len(args) < 2 || args[1] != "serve" {
		return args
	}
	for _, a := range args[2:] {
		if a == "--origins" || strings.HasPrefix(a, "--origins=") {
			return args
		}
	}
	return append(append([]string{}, args...), "--origins="+strings.Join(origins, ","))
}

// SignUpLimit caps account creation per IP: 5 sign-ups per 10 minutes.
var SignUpLimit = core.RateLimitRule{Label: "users:create", MaxRequests: 5, Duration: 600}

// RateLimitRules follow docs/backend-accounts-plan.md section 5.3. Duration is
// in seconds. A collection label ("users:create") wins over its wildcard
// ("*:create"), whatever the order.
var RateLimitRules = []core.RateLimitRule{
	{Label: "*:auth", MaxRequests: 10, Duration: 60},
	SignUpLimit,
	{Label: "saves:create", MaxRequests: 10, Duration: 60},
	{Label: "saves:update", MaxRequests: 30, Duration: 60},
	{Label: "*:create", MaxRequests: 20, Duration: 60},
	{Label: "/api/batch", MaxRequests: 3, Duration: 1},
	{Label: "/api/", MaxRequests: 300, Duration: 10},
}

// Apply writes the settings and the OAuth2 providers of the users collection.
func Apply(app core.App, cfg Config) error {
	settings := app.Settings()
	settings.RateLimits.Enabled = cfg.RateLimits
	settings.RateLimits.Rules = RateLimitRules
	settings.TrustedProxy.Headers = cfg.TrustedProxyHeaders
	settings.TrustedProxy.UseLeftmostIP = false
	settings.Batch.Enabled = false
	if err := app.Save(settings); err != nil {
		return err
	}

	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	users.OAuth2.Providers = nil
	for _, p := range cfg.Providers {
		users.OAuth2.Providers = append(users.OAuth2.Providers, core.OAuth2ProviderConfig{
			Name:         p.Name,
			ClientId:     p.ClientID,
			ClientSecret: p.ClientSecret,
		})
	}
	users.OAuth2.Enabled = len(users.OAuth2.Providers) > 0
	return app.Save(users)
}

func splitList(raw string) []string {
	var out []string
	for _, item := range strings.Split(raw, ",") {
		if item = strings.TrimSpace(item); item != "" {
			out = append(out, item)
		}
	}
	return out
}

// Getenv is os.Getenv, named so main reads plainly.
var Getenv = os.Getenv
