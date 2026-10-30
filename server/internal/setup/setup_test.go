package setup

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/fullfran/mazmorra-sombria/server/internal/hooks"
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

	// With no providers OAuth2 is off; email and password sign-in stays on.
	if err := Apply(app, Config{}); err != nil {
		t.Fatal(err)
	}
	users, _ = app.FindCollectionByNameOrId("users")
	if users.OAuth2.Enabled || len(users.OAuth2.Providers) != 0 {
		t.Fatalf("oauth2 should be disabled: %+v", users.OAuth2)
	}
	if !users.PasswordAuth.Enabled {
		t.Fatalf("password auth should stay enabled: %+v", users.PasswordAuth)
	}
}

// One IP gets SignUpLimit sign-ups per window; the next one answers 429.
func TestSignUpRateLimit(t *testing.T) {
	signUp := func(i int) *http.Request {
		body := fmt.Sprintf(`{"email":"user%d@example.com","password":"12345678","passwordConfirm":"12345678"}`, i)
		req := httptest.NewRequest(http.MethodPost, "/api/collections/users/records", strings.NewReader(body))
		req.Header.Set("content-type", "application/json")
		return req
	}

	scenario := tests.ApiScenario{
		Name:   "sign-up over the limit answers 429",
		Method: http.MethodPost,
		URL:    "/api/collections/users/records",
		Body:   strings.NewReader(`{"email":"one-too-many@example.com","password":"12345678","passwordConfirm":"12345678"}`),
		TestAppFactory: func(t testing.TB) *tests.TestApp {
			app, err := tests.NewTestApp(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			if err := Apply(app, Config{RateLimits: true}); err != nil {
				t.Fatal(err)
			}
			return app
		},
		BeforeTestFunc: func(t testing.TB, app *tests.TestApp, e *core.ServeEvent) {
			mux, err := e.Router.BuildMux()
			if err != nil {
				t.Fatal(err)
			}
			for i := range SignUpLimit.MaxRequests {
				rec := httptest.NewRecorder()
				mux.ServeHTTP(rec, signUp(i))
				if rec.Code != http.StatusOK {
					t.Fatalf("sign-up %d answered %d: %s", i, rec.Code, rec.Body)
				}
			}
		},
		ExpectedStatus:  429,
		ExpectedContent: []string{`"status":429`},
	}
	scenario.Test(t)
}

// resendEnv is a complete Resend SMTP environment (the key is a placeholder).
var resendEnv = map[string]string{
	"SD_SMTP_HOST":         "smtp.resend.com",
	"SD_SMTP_USERNAME":     "resend",
	"SD_SMTP_PASSWORD":     "re_test_placeholder",
	"SD_MAIL_FROM_ADDRESS": "no-reply@fullfran.com",
}

func withEnv(base map[string]string, extra map[string]string) map[string]string {
	out := map[string]string{}
	for k, v := range base {
		out[k] = v
	}
	for k, v := range extra {
		out[k] = v
	}
	return out
}

func TestFromEnvMail(t *testing.T) {
	cases := []struct {
		name    string
		env     map[string]string
		enabled bool
		partial bool
		port    int
		tls     bool
		from    string
		appURL  string
		appName string
	}{
		{"off by default", nil, false, false, 465, true, "", DefaultAppURL, DefaultAppName},
		{"on with the full Resend env", resendEnv, true, false, 465, true, "no-reply@fullfran.com", DefaultAppURL, DefaultAppName},
		{"port 587 defaults to STARTTLS", withEnv(resendEnv, map[string]string{"SD_SMTP_PORT": "587"}), true, false, 587, false, "no-reply@fullfran.com", DefaultAppURL, DefaultAppName},
		{"explicit TLS wins", withEnv(resendEnv, map[string]string{"SD_SMTP_PORT": "587", "SD_SMTP_TLS": "true"}), true, false, 587, true, "no-reply@fullfran.com", DefaultAppURL, DefaultAppName},
		{"bad port keeps 465", withEnv(resendEnv, map[string]string{"SD_SMTP_PORT": "abc"}), true, false, 465, true, "no-reply@fullfran.com", DefaultAppURL, DefaultAppName},
		{"app URL and name", withEnv(resendEnv, map[string]string{"SD_APP_URL": "http://127.0.0.1:8090", "SD_APP_NAME": "Shadow Dungeon"}), true, false, 465, true, "no-reply@fullfran.com", "http://127.0.0.1:8090", "Shadow Dungeon"},
		{"no password stays off", withEnv(resendEnv, map[string]string{"SD_SMTP_PASSWORD": ""}), false, true, 465, true, "no-reply@fullfran.com", DefaultAppURL, DefaultAppName},
		{"no host stays off", withEnv(resendEnv, map[string]string{"SD_SMTP_HOST": ""}), false, true, 465, true, "no-reply@fullfran.com", DefaultAppURL, DefaultAppName},
		{"no sender stays off", withEnv(resendEnv, map[string]string{"SD_MAIL_FROM_ADDRESS": ""}), false, true, 465, true, "", DefaultAppURL, DefaultAppName},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			m := FromEnv(envOf(tc.env)).Mail
			if m.SMTPEnabled() != tc.enabled || m.SMTPPartial() != tc.partial {
				t.Fatalf("enabled=%v partial=%v, want %v %v", m.SMTPEnabled(), m.SMTPPartial(), tc.enabled, tc.partial)
			}
			if m.Port != tc.port || m.TLS != tc.tls || m.FromAddress != tc.from || m.AppURL != tc.appURL || m.AppName != tc.appName {
				t.Fatalf("mail = %+v", m)
			}
			if m.FromName != DefaultMailName {
				t.Fatalf("from name = %q", m.FromName)
			}
		})
	}
}

func TestApplyMail(t *testing.T) {
	cases := []struct {
		name    string
		env     map[string]string
		enabled bool
	}{
		{"off by default", nil, false},
		{"on with the full env", resendEnv, true},
		{"partial env stays off", withEnv(resendEnv, map[string]string{"SD_SMTP_PASSWORD": ""}), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app, err := tests.NewTestApp(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			defer app.Cleanup()

			cfg := FromEnv(envOf(tc.env))
			if err := Apply(app, cfg); err != nil {
				t.Fatal(err)
			}
			s := app.Settings()
			if s.SMTP.Enabled != tc.enabled {
				t.Fatalf("smtp enabled = %v, want %v", s.SMTP.Enabled, tc.enabled)
			}
			if tc.enabled && (s.SMTP.Host != "smtp.resend.com" || s.SMTP.Port != 465 || !s.SMTP.TLS ||
				s.SMTP.Username != "resend" || s.SMTP.Password != "re_test_placeholder" ||
				s.Meta.SenderAddress != "no-reply@fullfran.com") {
				t.Fatalf("smtp not applied: host=%q port=%d tls=%v user=%q sender=%q",
					s.SMTP.Host, s.SMTP.Port, s.SMTP.TLS, s.SMTP.Username, s.Meta.SenderAddress)
			}
			if !tc.enabled && (s.SMTP.Host != "" || s.SMTP.Password != "") {
				t.Fatalf("smtp off should store no credentials: host=%q", s.SMTP.Host)
			}
			if s.Meta.AppURL != DefaultAppURL || s.Meta.AppName != DefaultAppName || s.Meta.SenderName != DefaultMailName {
				t.Fatalf("meta not applied: %+v", s.Meta)
			}

			users, err := app.FindCollectionByNameOrId("users")
			if err != nil {
				t.Fatal(err)
			}
			if users.VerificationTemplate != VerificationTemplate || users.ResetPasswordTemplate != ResetPasswordTemplate ||
				users.ConfirmEmailChangeTemplate != EmailChangeTemplate || users.OTP.EmailTemplate != OTPTemplate {
				t.Fatal("email templates not applied")
			}
			if users.AuthAlert.Enabled {
				t.Fatal("the new-login alert must stay off")
			}
			if users.AuthRule == nil || *users.AuthRule != "" {
				t.Fatalf("authRule changed: %v", users.AuthRule)
			}
		})
	}
}

// The templates are bilingual, carry the game name and link to the built-in
// confirmation pages; no em dashes.
func TestMailTemplates(t *testing.T) {
	templates := map[string]core.EmailTemplate{
		"verification": VerificationTemplate, "reset": ResetPasswordTemplate,
		"email change": EmailChangeTemplate, "otp": OTPTemplate, "auth alert": AuthAlertTemplate,
	}
	for name, tpl := range templates {
		if strings.Contains(tpl.Subject+tpl.Body, "\u2014") {
			t.Errorf("%s has an em dash", name)
		}
		if !strings.Contains(tpl.Subject, core.EmailPlaceholderAppName) || !strings.Contains(tpl.Body, "Hola") || !strings.Contains(tpl.Body, "Hi!") {
			t.Errorf("%s is not bilingual with the game name: %q", name, tpl.Subject)
		}
	}
	links := map[string]string{
		"/_/#/auth/confirm-verification/{TOKEN}":   VerificationTemplate.Body,
		"/_/#/auth/confirm-password-reset/{TOKEN}": ResetPasswordTemplate.Body,
		"/_/#/auth/confirm-email-change/{TOKEN}":   EmailChangeTemplate.Body,
		"{OTP}":                                    OTPTemplate.Body,
	}
	for want, body := range links {
		if !strings.Contains(body, want) {
			t.Errorf("template body lacks %s", want)
		}
	}
}

// waitForMail polls the test mailer: PocketBase sends some emails in the background.
func waitForMail(t testing.TB, app *tests.TestApp, n int) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for app.TestMailer.TotalSend() < n {
		if time.Now().After(deadline) {
			t.Fatalf("sent %d emails, want %d", app.TestMailer.TotalSend(), n)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func mailApp(env map[string]string) func(t testing.TB) *tests.TestApp {
	return func(t testing.TB) *tests.TestApp {
		app, err := tests.NewTestApp(t.TempDir())
		if err != nil {
			t.Fatal(err)
		}
		hooks.Register(app)
		if err := Apply(app, FromEnv(envOf(env))); err != nil {
			t.Fatal(err)
		}
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			t.Fatal(err)
		}
		dana := core.NewRecord(users)
		dana.SetEmail("dana@example.com")
		dana.SetPassword("12345678")
		if err := app.Save(dana); err != nil {
			t.Fatal(err)
		}
		return app
	}
}

func TestAccountEmails(t *testing.T) {
	signUpBody := `{"email":"new@example.com","password":"12345678","passwordConfirm":"12345678"}`
	resetBody := `{"email":"dana@example.com"}`
	scenarios := []tests.ApiScenario{
		{
			Name:           "with SMTP a sign-up sends the verification email",
			Method:         http.MethodPost,
			URL:            "/api/collections/users/records",
			Body:           strings.NewReader(signUpBody),
			TestAppFactory: mailApp(resendEnv),
			ExpectedStatus: 200,
			ExpectedContent: []string{
				`"verified":false`,
			},
			AfterTestFunc: func(t testing.TB, app *tests.TestApp, res *http.Response) {
				waitForMail(t, app, 1)
				msg := app.TestMailer.LastMessage()
				if msg.To[0].Address != "new@example.com" || msg.From.Address != "no-reply@fullfran.com" || msg.From.Name != DefaultMailName {
					t.Fatalf("unexpected message headers: to=%v from=%v", msg.To, msg.From)
				}
				if !strings.Contains(msg.Subject, DefaultAppName) || !strings.Contains(msg.HTML, DefaultAppURL+"/_/#/auth/confirm-verification/") {
					t.Fatalf("unexpected verification email: %q\n%s", msg.Subject, msg.HTML)
				}
			},
		},
		{
			Name:            "without SMTP a sign-up sends nothing",
			Method:          http.MethodPost,
			URL:             "/api/collections/users/records",
			Body:            strings.NewReader(signUpBody),
			TestAppFactory:  mailApp(nil),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"verified":false`},
			AfterTestFunc: func(t testing.TB, app *tests.TestApp, res *http.Response) {
				if n := app.TestMailer.TotalSend(); n != 0 {
					t.Fatalf("sent %d emails without SMTP", n)
				}
			},
		},
		{
			Name:           "with SMTP request-password-reset sends the reset email",
			Method:         http.MethodPost,
			URL:            "/api/collections/users/request-password-reset",
			Body:           strings.NewReader(resetBody),
			TestAppFactory: mailApp(resendEnv),
			ExpectedStatus: 204,
			AfterTestFunc: func(t testing.TB, app *tests.TestApp, res *http.Response) {
				waitForMail(t, app, 1)
				msg := app.TestMailer.LastMessage()
				if msg.To[0].Address != "dana@example.com" || !strings.Contains(msg.HTML, DefaultAppURL+"/_/#/auth/confirm-password-reset/") {
					t.Fatalf("unexpected reset email to %v:\n%s", msg.To, msg.HTML)
				}
			},
		},
	}
	for _, scenario := range scenarios {
		scenario.Test(t)
	}
}

func TestPasswordResetRateLimit(t *testing.T) {
	app, err := tests.NewTestApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()
	if err := Apply(app, Config{RateLimits: true}); err != nil {
		t.Fatal(err)
	}
	r, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	mux, err := r.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	ask := func() int {
		req := httptest.NewRequest(http.MethodPost, "/api/collections/users/request-password-reset", strings.NewReader(`{"email":"nobody@example.com"}`))
		req.Header.Set("content-type", "application/json")
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec.Code
	}
	for i := range PasswordResetLimit.MaxRequests {
		if code := ask(); code != http.StatusNoContent {
			t.Fatalf("request %d answered %d", i, code)
		}
	}
	if code := ask(); code != http.StatusTooManyRequests {
		t.Fatalf("over the limit answered %d", code)
	}
}
