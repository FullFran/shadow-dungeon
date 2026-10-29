package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"

	"github.com/fullfran/mazmorra-sombria/server/internal/rules"
)

// selfRule lets a user see, edit and delete only their own account.
const selfRule = `id = @request.auth.id`

// minPasswordLength is the shortest password accepted at sign-up.
const minPasswordLength = 8

func init() {
	m.Register(enablePasswordAccounts, disablePasswordAccounts)
}

// enablePasswordAccounts opens email + password accounts (owner decision of
// 2026-10-26). OAuth2 stays configured from the environment and becomes a
// way to link providers later. There is no SMTP yet, so an unverified
// account can sign in (authRule "") and nobody can reset a password.
// The hooks require an email on sign-up and keep it private.
func enablePasswordAccounts(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	users.PasswordAuth.Enabled = true
	users.PasswordAuth.IdentityFields = []string{core.FieldNameEmail}
	users.AuthRule = types.Pointer("")
	users.CreateRule = types.Pointer("")
	users.ListRule = types.Pointer(selfRule)
	users.ViewRule = types.Pointer(selfRule)
	users.UpdateRule = types.Pointer(selfRule)
	users.DeleteRule = types.Pointer(selfRule) // profile and save cascade
	if password, ok := users.Fields.GetByName(core.FieldNamePassword).(*core.PasswordField); ok {
		password.Min = minPasswordLength
	}
	if err := app.Save(users); err != nil {
		return err
	}

	return setSaveVersionMax(app, types.Pointer(float64(rules.MaxSaveVersion)))
}

func disablePasswordAccounts(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	users.PasswordAuth.Enabled = false
	users.CreateRule = nil
	if err := app.Save(users); err != nil {
		return err
	}
	return setSaveVersionMax(app, nil)
}

func setSaveVersionMax(app core.App, max *float64) error {
	saves, err := app.FindCollectionByNameOrId("saves")
	if err != nil {
		return err
	}
	if version, ok := saves.Fields.GetByName("version").(*core.NumberField); ok {
		version.Max = max
	}
	return app.Save(saves)
}
