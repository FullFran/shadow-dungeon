package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"

	"github.com/fullfran/mazmorra-sombria/server/internal/reports"
)

func init() {
	m.Register(createAdmins, dropAdmins)
}

// createAdmins adds the accounts allowed to triage reports. Every API rule
// stays nil: only superusers edit it in the dashboard, and the admin routes
// read it on the server, so nobody can name themselves an admin.
func createAdmins(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	c := core.NewBaseCollection(reports.AdminsCollection)
	c.ListRule = nil
	c.ViewRule = nil
	c.CreateRule = nil
	c.UpdateRule = nil
	c.DeleteRule = nil

	c.Fields.Add(
		&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
		&core.AutodateField{Name: "created", OnCreate: true},
	)
	c.AddIndex("idx_admins_user", true, "user", "")
	return app.Save(c)
}

func dropAdmins(app core.App) error {
	c, err := app.FindCollectionByNameOrId(reports.AdminsCollection)
	if err != nil {
		return err
	}
	return app.Delete(c)
}
