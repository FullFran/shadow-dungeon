package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"

	"github.com/fullfran/mazmorra-sombria/server/internal/friends"
)

func init() {
	m.Register(createFriends, dropFriends)
}

// createFriends adds the friend codes, presence and friendships. Every API
// rule stays nil: the records API, its filters and its expands stay closed,
// and the game reaches them only through /api/sd/friends. It touches no
// existing row: an account gets its code the first time it opens the friends
// window, so one that never uses friends stores nothing. Deleting an account
// removes its card and its friendships.
func createFriends(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}

	cards := core.NewBaseCollection(friends.CardsCollection)
	closeRules(cards)
	cards.Fields.Add(
		&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
		&core.TextField{Name: "code", Required: true, Max: friends.CodeLength, Pattern: friends.CodePattern},
		&core.DateField{Name: "seen"},
		&core.TextField{Name: "room", Max: friends.RoomLength, Pattern: friends.RoomPattern},
		&core.AutodateField{Name: "created", OnCreate: true},
	)
	cards.AddIndex("idx_friend_cards_user", true, "user", "")
	cards.AddIndex("idx_friend_cards_code", true, "code", "")
	if err := app.Save(cards); err != nil {
		return err
	}

	links := core.NewBaseCollection(friends.LinksCollection)
	closeRules(links)
	links.Fields.Add(
		&core.TextField{Name: "pair", Required: true, Max: 64},
		&core.RelationField{Name: "sender", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
		&core.RelationField{Name: "receiver", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
		&core.BoolField{Name: "accepted"},
		&core.AutodateField{Name: "created", OnCreate: true},
	)
	links.AddIndex("idx_friendships_pair", true, "pair", "")
	links.AddIndex("idx_friendships_sender", false, "sender", "")
	links.AddIndex("idx_friendships_receiver", false, "receiver", "")
	return app.Save(links)
}

func closeRules(c *core.Collection) {
	c.ListRule = nil
	c.ViewRule = nil
	c.CreateRule = nil
	c.UpdateRule = nil
	c.DeleteRule = nil
}

func dropFriends(app core.App) error {
	for _, name := range []string{friends.LinksCollection, friends.CardsCollection} {
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
