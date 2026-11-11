package clerkauth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/fullfran/mazmorra-sombria/server/internal/setup"
	_ "github.com/fullfran/mazmorra-sombria/server/migrations"
)

// fakeVerifier maps a bearer token to an identity; unknown tokens are invalid.
type fakeVerifier map[string]Identity

func (f fakeVerifier) Verify(_ context.Context, token string) (Identity, error) {
	id, ok := f[token]
	if !ok {
		return Identity{}, ErrInvalidToken
	}
	return id, nil
}

func newMux(t *testing.T, v Verifier) (*tests.TestApp, http.Handler) {
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
	Register(r, v)
	mux, err := r.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return app, mux
}

func exchange(mux http.Handler, header string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sd/clerk/session", nil)
	if header != "" {
		req.Header.Set("Authorization", header)
	}
	mux.ServeHTTP(rec, req)
	return rec
}

type authResponse struct {
	Token  string         `json:"token"`
	Record map[string]any `json:"record"`
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) authResponse {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var out authResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out.Token == "" || out.Record["id"] == nil {
		t.Fatalf("not an auth response: %s", rec.Body.String())
	}
	if _, leaked := out.Record["clerk_id"]; leaked {
		t.Fatalf("clerk_id must stay hidden: %s", rec.Body.String())
	}
	return out
}

func seedUser(t *testing.T, app core.App, email, clerkID string) *core.Record {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	u := core.NewRecord(col)
	u.SetEmail(email)
	u.SetPassword("a-long-password")
	if clerkID != "" {
		u.Set("clerk_id", clerkID)
	}
	if err := app.Save(u); err != nil {
		t.Fatal(err)
	}
	return u
}

func TestCreatesAVerifiedUserForANewClerkIdentity(t *testing.T) {
	app, mux := newMux(t, fakeVerifier{"good": {UserID: "user_new", Email: "New@Example.com", EmailVerified: true}})

	out := decode(t, exchange(mux, "Bearer good"))

	u, err := app.FindRecordById("users", out.Record["id"].(string))
	if err != nil {
		t.Fatal(err)
	}
	if u.GetString("clerk_id") != "user_new" || !u.Verified() || u.Email() != "new@example.com" {
		t.Fatalf("clerk_id %q verified %v email %q", u.GetString("clerk_id"), u.Verified(), u.Email())
	}
	if u.EmailVisibility() {
		t.Fatal("the email must stay private")
	}
	// The same exchange answers the same user.
	again := decode(t, exchange(mux, "Bearer good"))
	if again.Record["id"] != out.Record["id"] {
		t.Fatalf("second exchange made another user: %v vs %v", again.Record["id"], out.Record["id"])
	}
}

func TestLinksAnExistingUserByEmailCaseInsensitive(t *testing.T) {
	v := fakeVerifier{"good": {UserID: "user_1", Email: "Carol@EXAMPLE.com", EmailVerified: true}}
	app, mux := newMux(t, v)
	carol := seedUser(t, app, "carol@example.com", "")
	if carol.Verified() {
		t.Fatal("precondition: carol starts unverified")
	}

	out := decode(t, exchange(mux, "Bearer good"))

	if out.Record["id"] != carol.Id {
		t.Fatalf("linked %v, want %v", out.Record["id"], carol.Id)
	}
	got, err := app.FindRecordById("users", carol.Id)
	if err != nil {
		t.Fatal(err)
	}
	if got.GetString("clerk_id") != "user_1" || !got.Verified() {
		t.Fatalf("clerk_id %q verified %v", got.GetString("clerk_id"), got.Verified())
	}
	if n, _ := app.CountRecords("users"); n != 1 {
		t.Fatalf("%d users, want 1", n)
	}
}

func TestClerkIDWinsOverEmail(t *testing.T) {
	v := fakeVerifier{"good": {UserID: "user_1", Email: "changed@example.com", EmailVerified: true}}
	app, mux := newMux(t, v)
	linked := seedUser(t, app, "old@example.com", "user_1")
	other := seedUser(t, app, "changed@example.com", "")

	out := decode(t, exchange(mux, "Bearer good"))

	if out.Record["id"] != linked.Id || out.Record["id"] == other.Id {
		t.Fatalf("got %v, want the clerk_id user %v", out.Record["id"], linked.Id)
	}
	untouched, _ := app.FindRecordById("users", other.Id)
	if untouched.GetString("clerk_id") != "" {
		t.Fatal("the other account must not be linked")
	}
}

func TestRefusesAnUnverifiedEmailWith422(t *testing.T) {
	app, mux := newMux(t, fakeVerifier{"good": {UserID: "user_1", Email: "carol@example.com", EmailVerified: false}})
	seedUser(t, app, "carol@example.com", "")

	rec := exchange(mux, "Bearer good")
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if n, _ := app.CountRecords("users"); n != 1 {
		t.Fatalf("%d users, want 1: an unverified email must not create or link", n)
	}
}

func TestRefusesAMissingEmailWith422(t *testing.T) {
	_, mux := newMux(t, fakeVerifier{"good": {UserID: "user_1"}})
	if rec := exchange(mux, "Bearer good"); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d", rec.Code)
	}
}

func TestAnswers401ForMissingOrInvalidTokens(t *testing.T) {
	_, mux := newMux(t, fakeVerifier{})
	for _, header := range []string{"", "Bearer", "Bearer ", "Basic abc", "Bearer expired-or-forged"} {
		if rec := exchange(mux, header); rec.Code != http.StatusUnauthorized {
			t.Fatalf("header %q: status %d", header, rec.Code)
		}
	}
}

func TestAnswers503WhenClerkIsNotConfigured(t *testing.T) {
	app, mux := newMux(t, nil)
	if rec := exchange(mux, "Bearer anything"); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status %d", rec.Code)
	}
	if n, _ := app.CountRecords("users"); n != 0 {
		t.Fatal("no user may be created")
	}
}

func TestPasswordSignInKeepsWorkingForLinkedVerifiedAccounts(t *testing.T) {
	app, mux := newMux(t, fakeVerifier{"good": {UserID: "user_1", Email: "carol@example.com", EmailVerified: true}})
	carol := seedUser(t, app, "carol@example.com", "")
	carol.SetVerified(true)
	if err := app.Save(carol); err != nil {
		t.Fatal(err)
	}
	tokenKey := carol.TokenKey()

	decode(t, exchange(mux, "Bearer good"))

	u, err := app.FindAuthRecordByEmail("users", "carol@example.com")
	if err != nil || !u.ValidatePassword("a-long-password") {
		t.Fatalf("password sign-in broke: %v", err)
	}
	if u.TokenKey() != tokenKey {
		t.Fatal("linking a verified account must not sign its devices out")
	}
}

// Sign-up is open and unverified, so anyone can register somebody else's
// address with a password of their own before the real owner arrives.
func TestLinkingAnUnverifiedAccountDropsItsPasswordAndSessions(t *testing.T) {
	app, mux := newMux(t, fakeVerifier{"good": {UserID: "user_1", Email: "carol@example.com", EmailVerified: true}})
	squatter := seedUser(t, app, "carol@example.com", "")
	oldToken, err := squatter.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}

	out := decode(t, exchange(mux, "Bearer good"))

	if out.Record["id"] != squatter.Id {
		t.Fatalf("linked %v, want %v: the account and its save must be kept", out.Record["id"], squatter.Id)
	}
	u, err := app.FindRecordById("users", squatter.Id)
	if err != nil {
		t.Fatal(err)
	}
	if u.ValidatePassword("a-long-password") {
		t.Fatal("the password set before the email was proven must stop working")
	}
	login := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/collections/users/auth-with-password",
		strings.NewReader(`{"identity":"carol@example.com","password":"a-long-password"}`))
	req.Header.Set("Content-Type", "application/json")
	mux.ServeHTTP(login, req)
	if login.Code != http.StatusBadRequest {
		t.Fatalf("password sign-in answered %d, want 400: %s", login.Code, login.Body.String())
	}
	if _, err := app.FindAuthRecordByToken(oldToken, core.TokenTypeAuth); err == nil {
		t.Fatal("a session opened before the link must stop working")
	}
	if _, err := app.FindAuthRecordByToken(out.Token, core.TokenTypeAuth); err != nil {
		t.Fatalf("the session of the Clerk sign-in must work: %v", err)
	}
}

func TestClerkIDIsUniqueWhenSetAndRepeatableWhenEmpty(t *testing.T) {
	app, _ := newMux(t, nil)
	seedUser(t, app, "a@example.com", "")
	seedUser(t, app, "b@example.com", "")
	seedUser(t, app, "c@example.com", "user_x")
	col, _ := app.FindCollectionByNameOrId("users")
	dup := core.NewRecord(col)
	dup.SetEmail("d@example.com")
	dup.SetPassword("a-long-password")
	dup.Set("clerk_id", "user_x")
	if err := app.Save(dup); err == nil {
		t.Fatal("a repeated clerk_id must be rejected")
	}
}

func TestExchangeHasItsOwnRateLimit(t *testing.T) {
	found := false
	for _, r := range setup.RateLimitRules {
		if r == setup.ClerkSessionLimit {
			found = true
		}
	}
	if !found || setup.ClerkSessionLimit.Label != "POST /api/sd/clerk/session" {
		t.Fatalf("rate limit rule missing or mislabeled: %+v", setup.ClerkSessionLimit)
	}
}
