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

// fixture is a data directory with two users, where alice already has a
// save at rev 1. Each scenario clones it, so tokens stay valid everywhere.
type fixture struct {
	dir                  string
	aliceToken, bobToken string
	aliceID, bobID       string
	aliceSaveID          string
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
		aliceToken: aliceToken, bobToken: bobToken,
		aliceID: alice.Id, bobID: bob.Id,
		aliceSaveID: save.Id,
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
			Name:            "unknown save version is rejected",
			Method:          http.MethodPost,
			URL:             "/api/collections/saves/records",
			Headers:         auth(f.bobToken),
			Body:            strings.NewReader(`{"user":"` + f.bobID + `","data":{"version":9,"coins":0},"version":9,"rev":0}`),
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
			Headers:         auth(f.aliceToken),
			Body:            strings.NewReader(`{"user":"` + f.aliceID + `","nickname":"Alice","avatarSpecies":"zorua"}`),
			ExpectedStatus:  200,
			ExpectedContent: []string{`"nickname":"Alice"`},
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
			Name:            "users cannot sign up with a password",
			Method:          http.MethodPost,
			URL:             "/api/collections/users/records",
			Body:            strings.NewReader(`{"password":"12345678","passwordConfirm":"12345678"}`),
			ExpectedStatus:  403,
			ExpectedContent: []string{`"status":403`},
		},
	}

	for _, s := range scenarios {
		s.TestAppFactory = f.factory
		s.Test(t)
	}
}
