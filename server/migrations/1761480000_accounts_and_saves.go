// Package migrations holds the schema of the Shadow Dungeon API as Go
// migrations. Importing it registers them; `serve` applies pending ones.
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"

	"github.com/fullfran/mazmorra-sombria/server/internal/rules"
)

// Owner-only access, and the `user` relation can never be moved to someone else.
const (
	ownerRule      = `@request.auth.id != "" && user = @request.auth.id`
	ownerWriteRule = ownerRule + ` && (@request.body.user:isset = false || @request.body.user = @request.auth.id)`
)

func init() {
	m.Register(up, down)
}

func up(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	if err := slimUsers(app, users); err != nil {
		return err
	}

	if err := app.Save(newProfiles(users.Id)); err != nil {
		return err
	}
	return app.Save(newSaves(users.Id))
}

func down(app core.App) error {
	for _, name := range []string{"saves", "profiles"} {
		c, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			return err
		}
		if err := app.Delete(c); err != nil {
			return err
		}
	}
	return nil
}

// slimUsers keeps only what an OAuth2-only account needs: no password
// sign-in, no direct sign-up, an optional email and no copied provider
// name or avatar (src: docs/backend-accounts-plan.md section 4.4).
func slimUsers(app core.App, users *core.Collection) error {
	users.CreateRule = nil // accounts are created only through OAuth2
	users.PasswordAuth.Enabled = false
	users.OAuth2.Enabled = true
	users.OAuth2.MappedFields.Name = ""
	users.OAuth2.MappedFields.AvatarURL = ""
	users.Fields.RemoveByName("name")
	users.Fields.RemoveByName("avatar")

	if email, ok := users.Fields.GetByName(core.FieldNameEmail).(*core.EmailField); ok {
		email.Required = false
	}
	return app.Save(users)
}

func newProfiles(usersId string) *core.Collection {
	c := core.NewBaseCollection("profiles")
	c.ListRule = types.Pointer("")
	c.ViewRule = types.Pointer("")
	c.CreateRule = types.Pointer(ownerRule)
	c.UpdateRule = types.Pointer(ownerWriteRule)
	c.DeleteRule = nil

	c.Fields.Add(
		&core.RelationField{Name: "user", CollectionId: usersId, Required: true, MaxSelect: 1, CascadeDelete: true},
		&core.TextField{Name: "nickname", Required: true, Max: rules.NicknameMax},
		&core.TextField{Name: "avatarSpecies", Max: 32, Pattern: `^[a-z0-9-]+$`},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	c.AddIndex("idx_profiles_user", true, "user", "")
	return c
}

func newSaves(usersId string) *core.Collection {
	c := core.NewBaseCollection("saves")
	c.ListRule = types.Pointer(ownerRule)
	c.ViewRule = types.Pointer(ownerRule)
	c.CreateRule = types.Pointer(ownerRule)
	c.UpdateRule = types.Pointer(ownerWriteRule)
	c.DeleteRule = nil // superusers only; deleting the user cascades

	c.Fields.Add(
		&core.RelationField{Name: "user", CollectionId: usersId, Required: true, MaxSelect: 1, CascadeDelete: true},
		&core.JSONField{Name: "data", Required: true, MaxSize: rules.MaxSaveBytes},
		&core.NumberField{Name: "version", Required: true, OnlyInt: true, Min: types.Pointer(1.0)},
		&core.NumberField{Name: "rev", OnlyInt: true, Min: types.Pointer(0.0)},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	c.AddIndex("idx_saves_user", true, "user", "")
	return c
}
