package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

const clerkIDIndex = "idx_users_clerk_id"

func init() {
	m.Register(addClerkID, dropClerkID)
}

// addClerkID links an account to its Clerk user. The field is hidden (never in
// an API response) and unique only when set, since password accounts have none.
func addClerkID(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	users.Fields.Add(&core.TextField{Name: "clerk_id", Hidden: true, Max: 64})
	users.AddIndex(clerkIDIndex, true, "clerk_id", "clerk_id != ''")
	return app.Save(users)
}

func dropClerkID(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	users.RemoveIndex(clerkIDIndex)
	users.Fields.RemoveByName("clerk_id")
	return app.Save(users)
}
