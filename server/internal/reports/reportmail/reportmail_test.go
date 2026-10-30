package reportmail

import (
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/fullfran/mazmorra-sombria/server/internal/reports"
	_ "github.com/fullfran/mazmorra-sombria/server/migrations"
)

var notice = reports.Notice{Ref: "SD-AAAAAA", Category: "bug", Description: "<b>boss</b> froze", Version: "v1", Device: "Chrome / Android / touch"}

func newApp(t *testing.T) *tests.TestApp {
	t.Helper()
	app, err := tests.NewTestApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(app.Cleanup)
	app.Settings().SMTP.Enabled = true
	app.Settings().Meta.SenderAddress = "game@example.com"
	return app
}

func addAdmin(t *testing.T, app core.App, email string) {
	t.Helper()
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	u := core.NewRecord(users)
	u.SetEmail(email)
	u.SetPassword("a-long-password")
	if err := app.Save(u); err != nil {
		t.Fatal(err)
	}
	col, err := app.FindCollectionByNameOrId(reports.AdminsCollection)
	if err != nil {
		t.Fatal(err)
	}
	a := core.NewRecord(col)
	a.Set("user", u.Id)
	if err := app.Save(a); err != nil {
		t.Fatal(err)
	}
}

func addReports(t *testing.T, app core.App, n int) {
	t.Helper()
	col, err := app.FindCollectionByNameOrId(reports.Collection)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < n; i++ {
		r := core.NewRecord(col)
		r.Load(map[string]any{"ref": "SD-AAA" + string(rune('A'+i/26/26)) + string(rune('A'+i/26%26)) + string(rune('A'+i%26)), "category": "bug", "description": "x", "status": "new"})
		if err := app.Save(r); err != nil {
			t.Fatal(err)
		}
	}
}

func waitForMail(t *testing.T, app *tests.TestApp, want int) {
	t.Helper()
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(5 * time.Millisecond) {
		if app.TestMailer.TotalSend() == want {
			return
		}
	}
	t.Fatalf("mails = %d, want %d", app.TestMailer.TotalSend(), want)
}

func TestTellsEachAdminInPlainTextOnASeparateMail(t *testing.T) {
	app := newApp(t)
	addAdmin(t, app, "owner@example.com")
	addAdmin(t, app, "second@example.com")
	addReports(t, app, 1)
	New(app, time.Now)(notice)
	waitForMail(t, app, 2)
	seen := map[string]bool{}
	for _, m := range app.TestMailer.Messages() {
		if len(m.To) != 1 {
			t.Fatalf("recipients share a mail: %v", m.To)
		}
		seen[m.To[0].Address] = true
		if m.HTML != "" || !strings.Contains(m.Text, "<b>boss</b> froze") || !strings.Contains(m.Subject, "SD-AAAAAA") {
			t.Fatalf("%+v", m)
		}
		if strings.Contains(m.Subject, "boss") {
			t.Fatalf("player text in the subject: %q", m.Subject)
		}
	}
	if !seen["owner@example.com"] || !seen["second@example.com"] {
		t.Fatalf("%v", seen)
	}
}

func TestSendsNothingWithoutAdminsOrSMTP(t *testing.T) {
	app := newApp(t)
	addReports(t, app, 1)
	New(app, time.Now)(notice)
	addAdmin(t, app, "owner@example.com")
	app.Settings().SMTP.Enabled = false
	New(app, time.Now)(notice)
	if n := app.TestMailer.TotalSend(); n != 0 {
		t.Fatalf("mails = %d", n)
	}
}

func TestStopsMailingPastTheDailyLimit(t *testing.T) {
	app := newApp(t)
	addAdmin(t, app, "owner@example.com")
	addReports(t, app, DailyLimit)
	New(app, time.Now)(notice)
	waitForMail(t, app, 1)
	col, err := app.FindCollectionByNameOrId(reports.Collection)
	if err != nil {
		t.Fatal(err)
	}
	over := core.NewRecord(col)
	over.Load(map[string]any{"ref": "SD-ZZZZZZ", "category": "bug", "description": "x", "status": "new"})
	if err := app.Save(over); err != nil {
		t.Fatal(err)
	}
	New(app, time.Now)(notice)
	if n := app.TestMailer.TotalSend(); n != 1 {
		t.Fatalf("mails = %d", n)
	}
}
