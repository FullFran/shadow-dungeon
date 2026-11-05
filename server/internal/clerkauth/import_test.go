package clerkauth

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// fakeDirectory is a Clerk user list keyed by email; created records what was sent.
type fakeDirectory struct {
	existing map[string]bool
	created  map[string]string // email -> bcrypt digest
	failOn   string
}

func (f *fakeDirectory) Exists(_ context.Context, email string) (bool, error) {
	return f.existing[email], nil
}

func (f *fakeDirectory) Create(_ context.Context, email, digest string) error {
	if email == f.failOn {
		return errors.New("clerk said no")
	}
	f.created[email] = digest
	return nil
}

func addUser(t *testing.T, app core.App, email, password string, verified bool, clerkID string) {
	t.Helper()
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		t.Fatal(err)
	}
	u := core.NewRecord(users)
	u.SetEmail(email)
	u.SetPassword(password)
	u.SetVerified(verified)
	u.Set("clerk_id", clerkID)
	if err := app.Save(u); err != nil {
		t.Fatal(err)
	}
}

func newImportApp(t *testing.T) *tests.TestApp {
	t.Helper()
	app, err := tests.NewTestApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(app.Cleanup)
	return app
}

// Every verified password account not yet in Clerk is created there with its
// bcrypt hash, so its player signs in with the same password; nothing in
// PocketBase changes (the first sign-in links it by email).
func TestImportCreatesVerifiedUsersWithTheirHash(t *testing.T) {
	app := newImportApp(t)
	addUser(t, app, "new@example.com", "secret-pass-1", true, "")
	addUser(t, app, "already@example.com", "secret-pass-2", true, "")
	addUser(t, app, "linked@example.com", "secret-pass-3", true, "user_linked")
	addUser(t, app, "unverified@example.com", "secret-pass-4", false, "")
	before := snapshotUsers(t, app)

	dir := &fakeDirectory{existing: map[string]bool{"already@example.com": true}, created: map[string]string{}}
	report, err := Import(context.Background(), app, dir, true)
	if err != nil {
		t.Fatal(err)
	}

	if len(dir.created) != 1 || !strings.HasPrefix(dir.created["new@example.com"], "$2") {
		t.Fatalf("want only new@example.com created with a bcrypt digest, got %v", keys(dir.created))
	}
	want := Report{Created: []string{"new@example.com"}, InClerk: []string{"already@example.com"}, Linked: 1, Unverified: 1}
	if !sameReport(report, want) {
		t.Fatalf("report %+v, want %+v", report, want)
	}
	if after := snapshotUsers(t, app); after != before {
		t.Fatalf("import changed PocketBase users:\n%s\n---\n%s", before, after)
	}
}

// A dry run reports the same plan and sends nothing.
func TestImportDryRunSendsNothing(t *testing.T) {
	app := newImportApp(t)
	addUser(t, app, "new@example.com", "secret-pass-1", true, "")
	dir := &fakeDirectory{existing: map[string]bool{}, created: map[string]string{}}
	report, err := Import(context.Background(), app, dir, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(dir.created) != 0 {
		t.Fatalf("dry run created %v", keys(dir.created))
	}
	if len(report.Created) != 1 || report.Created[0] != "new@example.com" {
		t.Fatalf("dry run report %+v", report)
	}
}

// One refused user does not stop the others, and it is reported.
func TestImportKeepsGoingAfterAFailure(t *testing.T) {
	app := newImportApp(t)
	addUser(t, app, "a@example.com", "secret-pass-1", true, "")
	addUser(t, app, "b@example.com", "secret-pass-2", true, "")
	dir := &fakeDirectory{existing: map[string]bool{}, created: map[string]string{}, failOn: "a@example.com"}
	report, err := Import(context.Background(), app, dir, true)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := dir.created["b@example.com"]; !ok || len(report.Failed) != 1 || report.Failed[0] != "a@example.com" {
		t.Fatalf("report %+v, created %v", report, keys(dir.created))
	}
}

func snapshotUsers(t *testing.T, app core.App) string {
	t.Helper()
	rows := []struct {
		ID       string `db:"id"`
		Email    string `db:"email"`
		Password string `db:"password"`
		Verified bool   `db:"verified"`
		ClerkID  string `db:"clerk_id"`
	}{}
	if err := app.DB().NewQuery("SELECT id, email, password, verified, clerk_id FROM users ORDER BY id").All(&rows); err != nil {
		t.Fatal(err)
	}
	var b strings.Builder
	for _, r := range rows {
		b.WriteString(r.ID + "|" + r.Email + "|" + r.Password + "|" + r.ClerkID)
		if r.Verified {
			b.WriteString("|v")
		}
		b.WriteString("\n")
	}
	return b.String()
}

func keys(m map[string]string) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

func sameReport(a, b Report) bool {
	eq := func(x, y []string) bool { return strings.Join(x, ",") == strings.Join(y, ",") }
	return eq(a.Created, b.Created) && eq(a.InClerk, b.InClerk) && eq(a.Failed, b.Failed) && a.Linked == b.Linked && a.Unverified == b.Unverified
}
