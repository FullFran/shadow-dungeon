package hooks_test

import (
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/fullfran/mazmorra-sombria/server/internal/hooks"
	"github.com/fullfran/mazmorra-sombria/server/internal/rules"
	_ "github.com/fullfran/mazmorra-sombria/server/migrations"
)

// Carol signs in with email and password; alice and bob have no email
// (like accounts made through OAuth2).
const (
	carolEmail    = "carol@example.com"
	carolPassword = "correct-horse-battery"
)

// fixture is a data directory with three users, where alice already has a
// profile and a save at rev 1. Each scenario clones it, so tokens stay valid
// everywhere.
type fixture struct {
	dir                              string
	aliceToken, bobToken, carolToken string
	aliceID, bobID, carolID          string
	aliceSaveID, aliceProfileID      string
}

func newFixture(t *testing.T) fixture {
	t.Helper()

	app, err := tests.NewTestApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(app.DataDir()) })

	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	newUser := func() (*core.Record, string) {
		u := core.NewRecord(users)
		u.SetRandomPassword()
		if err := app.Save(u); err != nil {
			t.Fatal(err)
		}
		token, err := u.NewAuthToken()
		if err != nil {
			t.Fatal(err)
		}
		return u, token
	}
	alice, aliceToken := newUser()
	bob, bobToken := newUser()

	carol := core.NewRecord(users)
	carol.SetEmail(carolEmail)
	carol.SetPassword(carolPassword)
	if err := app.Save(carol); err != nil {
		t.Fatal(err)
	}
	carolToken, err := carol.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}

	profiles, err := app.FindCollectionByNameOrId("profiles")
	if err != nil {
		t.Fatal(err)
	}
	profile := core.NewRecord(profiles)
	profile.Load(map[string]any{"user": alice.Id, "nickname": "Alice"})
	if err := app.Save(profile); err != nil {
		t.Fatal(err)
	}

	saves, err := app.FindCollectionByNameOrId("saves")
	if err != nil {
		t.Fatal(err)
	}
	save := core.NewRecord(saves)
	save.Load(map[string]any{"user": alice.Id, "data": `{"version":3,"coins":10}`, "version": 3, "rev": 1})
	if err := app.Save(save); err != nil {
		t.Fatal(err)
	}

	f := fixture{
		dir:        app.DataDir(),
		aliceToken: aliceToken, bobToken: bobToken, carolToken: carolToken,
		aliceID: alice.Id, bobID: bob.Id, carolID: carol.Id,
		aliceSaveID: save.Id, aliceProfileID: profile.Id,
	}
	// Close the databases so the clone sees every write.
	if err := app.ResetBootstrapState(); err != nil {
		t.Fatal(err)
	}
	return f
}

func (f fixture) factory(t testing.TB) *tests.TestApp {
	app, err := tests.NewTestApp(f.dir)
	if err != nil {
		t.Fatal(err)
	}
	hooks.Register(app)
	return app
}

func auth(token string) map[string]string {
	return map[string]string{"Authorization": token}
}

func TestSavesAndProfiles(t *testing.T) {
	f := newFixture(t)
	saveURL := "/api/collections/saves/records/" + f.aliceSaveID
	oversize := `{"version":3,"coins":0,"pad":"` + strings.Repeat("x", rules.MaxSaveBytes) + `"}`

	scenarios := []tests.ApiScenario{
		{
			Name:            "owner updates own save with the current rev",
			Method:          http.MethodPatch,
			URL:             saveURL,
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"data":{"version":3,"coins":42},"version":3,"rev":1}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"rev":2`, `"coins":42`},
		},
		{
			Name:            "owner reads own save",
			Method:          http.MethodGet,
			URL:             saveURL,
			Headers:         auth(f.aliceToken),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"rev":1`},
		},
		{
			Name:            "stale rev answers 409 with the current save",
			Method:          http.MethodPatch,
			URL:             saveURL,
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"data":{"version":3,"coins":99},"version":3,"rev":0}`),
			ExpectedStatus:  409,
			ExpectedContent: []string{`"current":`, `"rev":1`, `"coins":10`},
		},
		{
			Name:            "update without rev is rejected",
			Method:          http.MethodPatch,
			URL:             saveURL,
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"data":{"version":3,"coins":99},"version":3}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`Missing rev`},
		},
		{
			Name:            "oversize save is rejected",
			Method:          http.MethodPatch,
			URL:             saveURL,
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"data":` + oversize + `,"version":3,"rev":1}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"data":{"data":{"code":`},
		},
		{
			Name:            "negative coins are rejected",
			Method:          http.MethodPatch,
			URL:             saveURL,
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"data":{"version":3,"coins":-5},"version":3,"rev":1}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`validation_invalid_save`},
		},
		{
			Name:            "another user cannot update the save",
			Method:          http.MethodPatch,
			URL:             saveURL,
			Headers:         auth(f.bobToken),
			Body:            strings.NewReader(`{"data":{"version":3,"coins":1},"version":3,"rev":1}`),
			ExpectedStatus:  404,
			ExpectedContent: []string{`"status":404`},
		},
		{
			Name:            "another user cannot view the save",
			Method:          http.MethodGet,
			URL:             saveURL,
			Headers:         auth(f.bobToken),
			ExpectedStatus:  404,
			ExpectedContent: []string{`"status":404`},
		},
		{
			Name:               "another user lists no saves",
			Method:             http.MethodGet,
			URL:                "/api/collections/saves/records",
			Headers:            auth(f.bobToken),
			ExpectedStatus:     200,
			ExpectedContent:    []string{`"totalItems":0`},
			NotExpectedContent: []string{f.aliceSaveID},
		},
		{
			Name:            "guests cannot list saves",
			Method:          http.MethodGet,
			URL:             "/api/collections/saves/records",
			ExpectedStatus:  200,
			ExpectedContent: []string{`"totalItems":0`},
		},
		{
			Name:            "owner cannot move the save to another user",
			Method:          http.MethodPatch,
			URL:             saveURL,
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"user":"` + f.bobID + `","version":3,"rev":1}`),
			ExpectedStatus:  404,
			ExpectedContent: []string{`"status":404`},
		},
		{
			Name:            "owner cannot delete the save",
			Method:          http.MethodDelete,
			URL:             saveURL,
			Headers:         auth(f.aliceToken),
			ExpectedStatus:  403,
			ExpectedContent: []string{`"status":403`},
		},
		{
			Name:            "new user creates a first save at rev 0",
			Method:          http.MethodPost,
			URL:             "/api/collections/saves/records",
			Headers:         auth(f.bobToken),
			Body:            strings.NewReader(`{"user":"` + f.bobID + `","data":{"version":3,"coins":0,"upgrades":{}},"version":3,"rev":0}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"rev":1`},
		},
		{
			Name:            "a second first save answers 409 with the existing one",
			Method:          http.MethodPost,
			URL:             "/api/collections/saves/records",
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"user":"` + f.aliceID + `","data":{"version":3,"coins":0},"version":3,"rev":0}`),
			ExpectedStatus:  409,
			ExpectedContent: []string{`"current":`, f.aliceSaveID},
		},
		{
			Name:            "nobody creates a save for someone else",
			Method:          http.MethodPost,
			URL:             "/api/collections/saves/records",
			Headers:         auth(f.bobToken),
			Body:            strings.NewReader(`{"user":"` + f.aliceID + `","data":{"version":3,"coins":0},"version":3,"rev":0}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"status":400`},
		},
		{
			Name:            "save version 0 is rejected",
			Method:          http.MethodPost,
			URL:             "/api/collections/saves/records",
			Headers:         auth(f.bobToken),
			Body:            strings.NewReader(`{"user":"` + f.bobID + `","data":{"version":0,"coins":0},"version":0,"rev":0}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"version":`, `validation_invalid_save`},
		},
		{
			Name:            "non-object save data is rejected",
			Method:          http.MethodPost,
			URL:             "/api/collections/saves/records",
			Headers:         auth(f.bobToken),
			Body:            strings.NewReader(`{"user":"` + f.bobID + `","data":[1,2],"version":3,"rev":0}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`validation_invalid_save`},
		},
		{
			Name:            "owner creates a profile with a clean nickname",
			Method:          http.MethodPost,
			URL:             "/api/collections/profiles/records",
			Headers:         auth(f.carolToken),
			Body:            strings.NewReader(`{"user":"` + f.carolID + `","nickname":"Carol","avatarSpecies":"zorua"}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"nickname":"Carol"`},
		},
		{
			Name:            "nickname with a zero-width character is rejected",
			Method:          http.MethodPost,
			URL:             "/api/collections/profiles/records",
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"user":"` + f.aliceID + `","nickname":"Ali​ce"}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`validation_invalid_nickname`},
		},
		{
			Name:            "nickname longer than 16 characters is rejected",
			Method:          http.MethodPost,
			URL:             "/api/collections/profiles/records",
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"user":"` + f.aliceID + `","nickname":"abcdefghijklmnopq"}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"nickname":`},
		},
		{
			Name:            "nobody creates a profile for someone else",
			Method:          http.MethodPost,
			URL:             "/api/collections/profiles/records",
			Headers:         auth(f.bobToken),
			Body:            strings.NewReader(`{"user":"` + f.aliceID + `","nickname":"Mallory"}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"status":400`},
		},
		{
			Name:            "owner updates their profile without sending user (the client's profile publish)",
			Method:          http.MethodPatch,
			URL:             "/api/collections/profiles/records/" + f.aliceProfileID,
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"nickname":"Alicia","avatarSpecies":"gastly"}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"nickname":"Alicia"`, `"avatarSpecies":"gastly"`},
		},
		{
			Name:            "nobody updates someone else's profile",
			Method:          http.MethodPatch,
			URL:             "/api/collections/profiles/records/" + f.aliceProfileID,
			Headers:         auth(f.bobToken),
			Body:            strings.NewReader(`{"nickname":"Mallory"}`),
			ExpectedStatus:  404,
			ExpectedContent: []string{`"status":404`},
		},
		{
			Name:            "the owner finds their own profile by user (the client's getProfile)",
			Method:          http.MethodGet,
			URL:             "/api/collections/profiles/records?filter=(user='" + f.aliceID + "')&perPage=1",
			Headers:         auth(f.aliceToken),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"totalItems":1`, `"nickname":"Alice"`},
		},
		{
			Name:            "a future save version within range is accepted",
			Method:          http.MethodPatch,
			URL:             saveURL,
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"data":{"version":4,"coins":7},"version":4,"rev":1}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"version":4`, `"rev":2`},
		},
		{
			Name:            "save version 100 is rejected",
			Method:          http.MethodPatch,
			URL:             saveURL,
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"data":{"version":100,"coins":7},"version":100,"rev":1}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"version":`, `validation_invalid_save`},
		},
	}

	for _, s := range scenarios {
		s.TestAppFactory = f.factory
		s.Test(t)
	}
}

func TestAccounts(t *testing.T) {
	f := newFixture(t)
	signUp := func(body string) *strings.Reader { return strings.NewReader(body) }

	scenarios := []tests.ApiScenario{
		{
			Name:               "sign-up with email and password",
			Method:             http.MethodPost,
			URL:                "/api/collections/users/records",
			Body:               signUp(`{"email":"new@example.com","password":"12345678","passwordConfirm":"12345678"}`),
			ExpectedStatus:     200,
			ExpectedContent:    []string{`"collectionName":"users"`, `"verified":false`, `"emailVisibility":false`},
			NotExpectedContent: []string{`"password"`, `new@example.com`},
		},
		{
			Name:               "sign-up cannot make the email public or the account verified",
			Method:             http.MethodPost,
			URL:                "/api/collections/users/records",
			Body:               signUp(`{"email":"sneaky@example.com","emailVisibility":true,"verified":true,"password":"12345678","passwordConfirm":"12345678"}`),
			ExpectedStatus:     200,
			ExpectedContent:    []string{`"verified":false`, `"emailVisibility":false`},
			NotExpectedContent: []string{`sneaky@example.com`},
		},
		{
			Name:            "sign-up with a password shorter than 8 characters is rejected",
			Method:          http.MethodPost,
			URL:             "/api/collections/users/records",
			Body:            signUp(`{"email":"short@example.com","password":"1234567","passwordConfirm":"1234567"}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"password":{"code":"validation_min_text_constraint"`},
		},
		{
			Name:            "sign-up with an email already in use is rejected",
			Method:          http.MethodPost,
			URL:             "/api/collections/users/records",
			Body:            signUp(`{"email":"` + carolEmail + `","password":"12345678","passwordConfirm":"12345678"}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"email":{"code":"validation_not_unique"`},
		},
		{
			Name:            "sign-up without an email is rejected",
			Method:          http.MethodPost,
			URL:             "/api/collections/users/records",
			Body:            signUp(`{"password":"12345678","passwordConfirm":"12345678"}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"email":{"code":"validation_required"`},
		},
		{
			Name:            "login with email and password returns a token",
			Method:          http.MethodPost,
			URL:             "/api/collections/users/auth-with-password",
			Body:            strings.NewReader(`{"identity":"` + carolEmail + `","password":"` + carolPassword + `"}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"token":"`, `"email":"` + carolEmail + `"`, `"verified":false`},
		},
		{
			Name:            "login with a wrong password is rejected",
			Method:          http.MethodPost,
			URL:             "/api/collections/users/auth-with-password",
			Body:            strings.NewReader(`{"identity":"` + carolEmail + `","password":"wrong-password"}`),
			ExpectedStatus:  400,
			ExpectedContent: []string{`"status":400`},
		},
		{
			Name:            "a signed-in user refreshes the token",
			Method:          http.MethodPost,
			URL:             "/api/collections/users/auth-refresh",
			Headers:         auth(f.carolToken),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"token":"`, f.carolID},
		},
		{
			Name:            "owner cannot make the email public or verify the account by update",
			Method:          http.MethodPatch,
			URL:             "/api/collections/users/records/" + f.carolID,
			Headers:         auth(f.carolToken),
			Body:            strings.NewReader(`{"emailVisibility":true,"verified":true}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"emailVisibility":false`, `"verified":false`},
			AfterTestFunc: func(t testing.TB, app *tests.TestApp, res *http.Response) {
				carol, err := app.FindRecordById("users", f.carolID)
				if err != nil {
					t.Fatal(err)
				}
				if carol.EmailVisibility() || carol.Verified() {
					t.Fatalf("emailVisibility=%v verified=%v, want both false", carol.EmailVisibility(), carol.Verified())
				}
			},
		},
		{
			Name:           "owner deletes their account with its profile and save",
			Method:         http.MethodDelete,
			URL:            "/api/collections/users/records/" + f.aliceID,
			Headers:        auth(f.aliceToken),
			ExpectedStatus: 204,
			AfterTestFunc: func(t testing.TB, app *tests.TestApp, res *http.Response) {
				if _, err := app.FindRecordById("saves", f.aliceSaveID); err == nil {
					t.Fatal("the save survived the account deletion")
				}
				if _, err := app.FindRecordById("profiles", f.aliceProfileID); err == nil {
					t.Fatal("the profile survived the account deletion")
				}
			},
		},
		{
			Name:            "nobody deletes someone else's account",
			Method:          http.MethodDelete,
			URL:             "/api/collections/users/records/" + f.aliceID,
			Headers:         auth(f.bobToken),
			ExpectedStatus:  404,
			ExpectedContent: []string{`"status":404`},
		},
		{
			Name:            "guests cannot delete accounts",
			Method:          http.MethodDelete,
			URL:             "/api/collections/users/records/" + f.aliceID,
			ExpectedStatus:  404,
			ExpectedContent: []string{`"status":404`},
		},
	}

	for _, s := range scenarios {
		s.TestAppFactory = f.factory
		s.Test(t)
	}
}
