// Package ranking derives the Sima del Eclipse global ranking from the cloud
// saves (odd/tasks/sima-global-ranking.md in the game repo): every account
// already uploads its Sima board inside `saves.data.profile.board`, so the
// ranking is a read of what exists, with no submissions of its own.
//
// It is pure: the route (rankingapi) loads the records and passes them in.
// The board rules mirror the client's `src/town/leaderboard.ts`
// (`parseEntry`, `scoreTier`, `compareScores`); a malformed save, board or
// entry is skipped, never an error.
package ranking

import (
	"bytes"
	"encoding/json"
	"regexp"
	"sort"
)

// Size is how many players a tier's ranking shows.
const Size = 50

// maxBoard caps the entries read from one board (the client keeps 10 per
// tier and reads at most 200).
const maxBoard = 200

// maxSafe is JavaScript's Number.MAX_SAFE_INTEGER: the client never writes a
// bigger whole number.
const maxSafe = 1<<53 - 1

// Tiers are the client's difficulty ids (`src/data/difficulty.ts`).
var Tiers = []string{"easy", "normal", "hard", "nightmare"}

// DefaultTier is the client's DEFAULT_DIFFICULTY: the tier of a score with
// no difficulty (every score from before tiers).
const DefaultTier = "easy"

// IsTier reports whether s is a known difficulty id.
func IsTier(s string) bool {
	for _, t := range Tiers {
		if t == s {
			return true
		}
	}
	return false
}

// Save is one cloud save: its owner's user id and the raw `data` JSON.
type Save struct {
	User string
	Data []byte
}

// Profile is the public part of a player (the `profiles` collection).
type Profile struct {
	Nickname      string
	AvatarSpecies string
}

// Entry is one row of the public ranking: nothing beyond these fields leaves
// the server.
type Entry struct {
	Rank          int    `json:"rank"`
	Nickname      string `json:"nickname"`
	AvatarSpecies string `json:"avatarSpecies"`
	Floor         int64  `json:"floor"`
	ClockMs       int64  `json:"clockMs"`
	Species       string `json:"species"`
	Level         int64  `json:"level"`
	Mode          string `json:"mode"`
	Date          string `json:"date"`
}

var (
	idPattern   = regexp.MustCompile(`^[a-z0-9-]{1,40}$`)
	datePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
)

// Build returns the ranking of tier: each player's best score on it, deeper
// first and then more time left, top Size. Players without a profile (or
// with an empty nickname) are skipped: the ranking only shows names that are
// already public. Ties between players fall back to nickname, then user id,
// so the order never depends on the order of saves.
func Build(saves []Save, profiles map[string]Profile, tier string) []Entry {
	type best struct {
		user string
		e    Entry
	}
	var all []best
	for _, s := range saves {
		p, ok := profiles[s.User]
		if !ok || p.Nickname == "" {
			continue
		}
		var top *Entry
		for _, raw := range boardOf(s.Data) {
			e, ok := parseEntry(raw, tier)
			if !ok {
				continue
			}
			if top == nil || better(e, *top) {
				top = &e
			}
		}
		if top == nil {
			continue
		}
		top.Nickname, top.AvatarSpecies = p.Nickname, p.AvatarSpecies
		all = append(all, best{s.User, *top})
	}
	sort.Slice(all, func(i, j int) bool {
		a, b := all[i], all[j]
		if better(a.e, b.e) || better(b.e, a.e) {
			return better(a.e, b.e)
		}
		if a.e.Nickname != b.e.Nickname {
			return a.e.Nickname < b.e.Nickname
		}
		return a.user < b.user
	})
	if len(all) > Size {
		all = all[:Size]
	}
	out := make([]Entry, len(all))
	for i, b := range all {
		out[i] = b.e
		out[i].Rank = i + 1
	}
	return out
}

// better is `compareScores(a, b) < 0`: deeper, or as deep with more time left.
func better(a, b Entry) bool {
	if a.Floor != b.Floor {
		return a.Floor > b.Floor
	}
	return a.ClockMs > b.ClockMs
}

// boardOf reads `profile.board` from a save's data; anything else is empty.
func boardOf(data []byte) []json.RawMessage {
	var save struct {
		Profile json.RawMessage `json:"profile"`
	}
	if json.Unmarshal(data, &save) != nil {
		return nil
	}
	var profile struct {
		Board json.RawMessage `json:"board"`
	}
	if json.Unmarshal(save.Profile, &profile) != nil {
		return nil
	}
	var entries []json.RawMessage
	if json.Unmarshal(profile.Board, &entries) != nil {
		return nil
	}
	if len(entries) > maxBoard {
		entries = entries[:maxBoard]
	}
	return entries
}

// parseEntry is the client's parseEntry, narrowed to tier: whole numbers in
// range, a known mode, date and species, and a difficulty that is absent
// (easy) or a known tier. An unknown difficulty is skipped, not read as easy.
func parseEntry(raw json.RawMessage, tier string) (Entry, bool) {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var e map[string]any
	if dec.Decode(&e) != nil || e == nil {
		return Entry{}, false
	}
	floor, ok1 := whole(e["floor"], 1)
	clock, ok2 := whole(e["clockMs"], 0)
	level, ok3 := whole(e["level"], 1)
	_, ok4 := whole(e["seed"], -(1 << 31))
	if !ok1 || !ok2 || !ok3 || !ok4 {
		return Entry{}, false
	}
	mode, _ := e["mode"].(string)
	date, _ := e["date"].(string)
	species, _ := e["species"].(string)
	if (mode != "daily" && mode != "free") || !datePattern.MatchString(date) || !idPattern.MatchString(species) {
		return Entry{}, false
	}
	d := DefaultTier
	if v, present := e["difficulty"]; present && v != nil {
		s, ok := v.(string)
		if !ok || !IsTier(s) {
			return Entry{}, false
		}
		d = s
	}
	if d != tier {
		return Entry{}, false
	}
	return Entry{Floor: floor, ClockMs: clock, Species: species, Level: level, Mode: mode, Date: date}, true
}

// whole reads v as a safe whole number of at least min.
func whole(v any, min int64) (int64, bool) {
	n, ok := v.(json.Number)
	if !ok {
		return 0, false
	}
	i, err := n.Int64()
	if err != nil || i < min || i > maxSafe {
		return 0, false
	}
	return i, true
}
