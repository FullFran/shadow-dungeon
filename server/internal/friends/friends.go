// Package friends holds the shape of the friends feature: the collections, the
// friend code and room code formats, the caps and the presence rule, shared by
// the migration that creates the collections and the routes that use them.
// Nothing here touches PocketBase (server/README.md, "Friends").
package friends

import (
	"regexp"
	"time"
)

// CardsCollection holds one account's friend code and presence.
const CardsCollection = "friend_cards"

// LinksCollection holds one row per pair of accounts: a pending request, or,
// once accepted, a friendship. The unique pair makes a duplicate impossible.
const LinksCollection = "friendships"

// CodeAlphabet mirrors ROOM_CODE_ALPHABET in src/net/room-code.ts: no
// characters that read alike (tests/app/friends-screen.test.ts compares them).
const CodeAlphabet = "ACDEFHJKMNPRTUWXY3479"

// Lengths of a friend code (21^8, about 38 billion) and of a room code.
const (
	CodeLength = 8
	RoomLength = 5
)

// Regular expressions for a friend code and a room code.
const (
	CodePattern = `^[` + CodeAlphabet + `]{8}$`
	RoomPattern = `^[` + CodeAlphabet + `]{5}$`
)

var (
	validCode = regexp.MustCompile(CodePattern)
	validRoom = regexp.MustCompile(RoomPattern)
)

// ValidCode reports whether s is a friend code in canonical form.
func ValidCode(s string) bool { return validCode.MatchString(s) }

// ValidRoom reports whether s is a room code in canonical form.
func ValidRoom(s string) bool { return validRoom.MatchString(s) }

// Caps per account.
const (
	MaxFriends = 50
	// MaxPending caps the requests an account has sent, and those waiting for it.
	MaxPending = 50
)

// OnlineWindow is how long a heartbeat counts: the client sends one a minute
// while its tab is visible, so a missed beat or two does not read as offline.
const OnlineWindow = 3 * time.Minute

// The states a friend shows.
const (
	StateOffline = "offline"
	StateOnline  = "online"
	StateRoom    = "room"
)

// State is what a friend shows from its last heartbeat, and the room code when
// it is in a room. A stale heartbeat hides the room too: a closed tab left it.
func State(seen time.Time, room string, now time.Time) (string, string) {
	if seen.IsZero() || now.Sub(seen) > OnlineWindow {
		return StateOffline, ""
	}
	if room != "" {
		return StateRoom, room
	}
	return StateOnline, ""
}

// Pair is the key of two accounts, the same whichever comes first.
func Pair(a, b string) string {
	if a > b {
		a, b = b, a
	}
	return a + ":" + b
}
