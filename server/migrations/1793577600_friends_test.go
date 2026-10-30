package migrations

import (
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"

	"github.com/fullfran/mazmorra-sombria/server/internal/friends"
)

func seedUser(t *testing.T, app core.App, email string) *core.Record {
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
	return u
}

func TestFriendsMigrationDownAndUpOverExistingAccounts(t *testing.T) {
	app, err := tests.NewTestApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(app.Cleanup)
	u := seedUser(t, app, "old@example.com")
	profiles, err := app.FindCollectionByNameOrId("profiles")
	if err != nil {
		t.Fatal(err)
	}
	p := core.NewRecord(profiles)
	p.Load(map[string]any{"user": u.Id, "nickname": "Old"})
	if err := app.Save(p); err != nil {
		t.Fatal(err)
	}
	before, err := app.CountRecords("users")
	if err != nil {
		t.Fatal(err)
	}

	if err := dropFriends(app); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{friends.CardsCollection, friends.LinksCollection} {
		if _, err := app.FindCollectionByNameOrId(name); err == nil {
			t.Fatalf("%s survived down", name)
		}
	}
	if err := createFriends(app); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{friends.CardsCollection, friends.LinksCollection} {
		c, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			t.Fatal(err)
		}
		if c.ListRule != nil || c.ViewRule != nil || c.CreateRule != nil || c.UpdateRule != nil || c.DeleteRule != nil {
			t.Fatalf("%s has an API rule", name)
		}
		// Up gives an existing account nothing: its code comes when it opens the window.
		if n, err := app.CountRecords(name); err != nil || n != 0 {
			t.Fatalf("%s has %d rows, %v", name, n, err)
		}
	}
	after, err := app.CountRecords("users")
	if err != nil || after != before {
		t.Fatalf("users %d -> %d, %v", before, after, err)
	}
	stored, err := app.FindRecordById("users", u.Id)
	if err != nil || stored.Email() != "old@example.com" || !stored.ValidatePassword("a-long-password") {
		t.Fatalf("account changed: %v %v", stored, err)
	}
	kept, err := app.FindRecordById("profiles", p.Id)
	if err != nil || kept.GetString("nickname") != "Old" {
		t.Fatalf("profile changed: %v %v", kept, err)
	}
}
