package reportsadmin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/fullfran/mazmorra-sombria/server/internal/reports"
	_ "github.com/fullfran/mazmorra-sombria/server/migrations"
)

func newApp(t *testing.T) (*tests.TestApp, http.Handler) {
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
	Register(r, app)
	m, err := r.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return app, m
}

func user(t *testing.T, app core.App, email string) (*core.Record, string) {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	u := core.NewRecord(col)
	u.SetEmail(email)
	u.SetPassword("a-long-password")
	if err := app.Save(u); err != nil {
		t.Fatal(err)
	}
	token, err := u.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	return u, token
}

func admin(t *testing.T, app core.App, email string) string {
	t.Helper()
	u, token := user(t, app, email)
	col, err := app.FindCollectionByNameOrId(reports.AdminsCollection)
	if err != nil {
		t.Fatal(err)
	}
	a := core.NewRecord(col)
	a.Set("user", u.Id)
	if err := app.Save(a); err != nil {
		t.Fatal(err)
	}
	return token
}

func seed(t *testing.T, app core.App, ref, status string) *core.Record {
	t.Helper()
	col, err := app.FindCollectionByNameOrId(reports.Collection)
	if err != nil {
		t.Fatal(err)
	}
	r := core.NewRecord(col)
	r.Load(map[string]any{"ref": ref, "category": "bug", "description": "broken " + ref, "client": "a-client-hash", "status": status})
	if err := app.Save(r); err != nil {
		t.Fatal(err)
	}
	return r
}

func call(m http.Handler, method, url, token, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, url, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	m.ServeHTTP(rec, req)
	return rec
}

var routes = []struct{ method, url, body string }{
	{http.MethodGet, "/api/sd/admin/me", ""},
	{http.MethodGet, "/api/sd/admin/reports", ""},
	{http.MethodPatch, "/api/sd/admin/reports/SD-AAAAAA", `{"status":"closed"}`},
}

func TestEveryRouteRefusesGuestsAndPlainPlayers(t *testing.T) {
	app, m := newApp(t)
	seed(t, app, "SD-AAAAAA", "new")
	_, player := user(t, app, "player@example.com")
	for _, c := range routes {
		if rec := call(m, c.method, c.url, "", c.body); rec.Code != http.StatusUnauthorized {
			t.Errorf("guest %s %s: %d", c.method, c.url, rec.Code)
		}
		rec := call(m, c.method, c.url, player, c.body)
		if rec.Code != http.StatusForbidden || strings.Contains(rec.Body.String(), "broken") {
			t.Errorf("player %s %s: %d %s", c.method, c.url, rec.Code, rec.Body.String())
		}
	}
	r, err := app.FindFirstRecordByData(reports.Collection, "ref", "SD-AAAAAA")
	if err != nil || r.GetString("status") != "new" {
		t.Fatalf("report changed: %v %v", r, err)
	}
}

func TestASuperuserTokenIsNotAnAdminAccount(t *testing.T) {
	app, m := newApp(t)
	col, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		t.Fatal(err)
	}
	s := core.NewRecord(col)
	s.SetEmail("root@example.com")
	s.SetPassword("a-long-password")
	if err := app.Save(s); err != nil {
		t.Fatal(err)
	}
	token, err := s.NewAuthToken()
	if err != nil {
		t.Fatal(err)
	}
	if rec := call(m, http.MethodGet, "/api/sd/admin/me", token, ""); rec.Code != http.StatusForbidden {
		t.Fatalf("superuser: %d", rec.Code)
	}
}

func TestAnAdminIsToldSo(t *testing.T) {
	app, m := newApp(t)
	token := admin(t, app, "owner@example.com")
	rec := call(m, http.MethodGet, "/api/sd/admin/me", token, "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"admin":true`) {
		t.Fatalf("%d %s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("cache-control %q", got)
	}
}

func TestDeletingTheAccountRemovesTheAdmin(t *testing.T) {
	app, _ := newApp(t)
	admin(t, app, "owner@example.com")
	u, err := app.FindAuthRecordByEmail("users", "owner@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if err := app.Delete(u); err != nil {
		t.Fatal(err)
	}
	if n, err := app.CountRecords(reports.AdminsCollection); err != nil || n != 0 {
		t.Fatalf("admins = %d, %v", n, err)
	}
}

type listBody struct {
	Items []map[string]any `json:"items"`
	Total int              `json:"total"`
}

func listed(t *testing.T, m http.Handler, url, token string) listBody {
	t.Helper()
	rec := call(m, http.MethodGet, url, token, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("%s: %d %s", url, rec.Code, rec.Body.String())
	}
	var body listBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	return body
}

func TestListsReportsWithoutTheClientHash(t *testing.T) {
	app, m := newApp(t)
	token := admin(t, app, "owner@example.com")
	seed(t, app, "SD-AAAAAA", "new")
	seed(t, app, "SD-BBBBBB", "closed")
	body := listed(t, m, "/api/sd/admin/reports", token)
	if body.Total != 2 || len(body.Items) != 2 {
		t.Fatalf("%+v", body)
	}
	for _, item := range body.Items {
		if _, leaked := item["client"]; leaked {
			t.Fatalf("client hash leaked: %v", item)
		}
		for _, want := range []string{"ref", "created", "category", "status", "description", "steps", "expected", "observed", "version", "device", "diagnostics", "githubIssue"} {
			if _, ok := item[want]; !ok {
				t.Fatalf("missing %s: %v", want, item)
			}
		}
	}
}

func TestListsTheNewestFirstAndCountsPastTheLimit(t *testing.T) {
	app, m := newApp(t)
	token := admin(t, app, "owner@example.com")
	for i := 0; i < ListLimit+1; i++ {
		r := seed(t, app, "SD-"+strings.Repeat("A", 3)+string(rune('A'+i/26/26))+string(rune('A'+i/26%26))+string(rune('A'+i%26)), "new")
		// Autodates only go forward on save, so the order comes from a direct write.
		if _, err := app.DB().NewQuery("UPDATE reports SET created = {:at} WHERE id = {:id}").Bind(map[string]any{"at": "2026-10-" + map[bool]string{true: "01", false: "02"}[i == ListLimit] + " 10:00:00.000Z", "id": r.Id}).Execute(); err != nil {
			t.Fatal(err)
		}
	}
	body := listed(t, m, "/api/sd/admin/reports", token)
	if body.Total != ListLimit+1 || len(body.Items) != ListLimit {
		t.Fatalf("total %d, items %d", body.Total, len(body.Items))
	}
	for _, item := range body.Items {
		if strings.HasPrefix(item["created"].(string), "2026-10-01") {
			t.Fatal("the oldest report should be the one past the limit")
		}
	}
}

func TestFiltersByStatus(t *testing.T) {
	app, m := newApp(t)
	token := admin(t, app, "owner@example.com")
	seed(t, app, "SD-AAAAAA", "new")
	seed(t, app, "SD-BBBBBB", "closed")
	body := listed(t, m, "/api/sd/admin/reports?status=closed", token)
	if body.Total != 1 || body.Items[0]["ref"] != "SD-BBBBBB" {
		t.Fatalf("%+v", body)
	}
	if rec := call(m, http.MethodGet, "/api/sd/admin/reports?status=nope", token, ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown status: %d", rec.Code)
	}
}

func TestAnAdminMovesAReportThroughTheTriageStatuses(t *testing.T) {
	app, m := newApp(t)
	token := admin(t, app, "owner@example.com")
	seed(t, app, "SD-AAAAAA", "new")
	for _, status := range reports.TriageStatuses {
		rec := call(m, http.MethodPatch, "/api/sd/admin/reports/SD-AAAAAA", token, `{"status":"`+status+`"}`)
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"status":"`+status+`"`) {
			t.Fatalf("%s: %d %s", status, rec.Code, rec.Body.String())
		}
		r, err := app.FindFirstRecordByData(reports.Collection, "ref", "SD-AAAAAA")
		if err != nil || r.GetString("status") != status {
			t.Fatalf("%s: stored %v, %v", status, r, err)
		}
	}
}

func TestAPatchChangesTheStatusAndNothingElse(t *testing.T) {
	app, m := newApp(t)
	token := admin(t, app, "owner@example.com")
	seed(t, app, "SD-AAAAAA", "new")
	for _, c := range []struct {
		name, ref, body string
		want            int
	}{
		{"another field", "SD-AAAAAA", `{"status":"closed","description":"rewritten"}`, http.StatusBadRequest},
		{"only another field", "SD-AAAAAA", `{"description":"rewritten"}`, http.StatusBadRequest},
		{"issue needs a link", "SD-AAAAAA", `{"status":"issue"}`, http.StatusBadRequest},
		{"unknown status", "SD-AAAAAA", `{"status":"nope"}`, http.StatusBadRequest},
		{"malformed", "SD-AAAAAA", `{`, http.StatusBadRequest},
		{"unknown ref", "SD-ZZZZZZ", `{"status":"closed"}`, http.StatusNotFound},
		{"bad ref", "nope", `{"status":"closed"}`, http.StatusNotFound},
	} {
		if rec := call(m, http.MethodPatch, "/api/sd/admin/reports/"+c.ref, token, c.body); rec.Code != c.want {
			t.Errorf("%s: %d %s", c.name, rec.Code, rec.Body.String())
		}
	}
	r, err := app.FindFirstRecordByData(reports.Collection, "ref", "SD-AAAAAA")
	if err != nil || r.GetString("status") != "new" || r.GetString("description") != "broken SD-AAAAAA" {
		t.Fatalf("report changed: %v %v", r, err)
	}
}

func TestNobodyNamesThemselvesAdminThroughTheRecordsAPI(t *testing.T) {
	app, m := newApp(t)
	seed(t, app, "SD-AAAAAA", "new")
	u, player := user(t, app, "player@example.com")
	owner := admin(t, app, "owner@example.com")
	for _, c := range []struct{ method, url, token, body string }{
		{http.MethodPost, "/api/collections/admins/records", player, `{"user":"` + u.Id + `"}`},
		{http.MethodGet, "/api/collections/admins/records", player, ""},
		{http.MethodGet, "/api/collections/reports/records", owner, ""},
	} {
		rec := call(m, c.method, c.url, c.token, c.body)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s %s: %d %s", c.method, c.url, rec.Code, rec.Body.String())
		}
	}
	if n, err := app.CountRecords(reports.AdminsCollection); err != nil || n != 1 {
		t.Fatalf("admins = %d, %v", n, err)
	}
}
