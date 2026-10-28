package ranking

import (
	"fmt"
	"strings"
	"testing"
)

// save wraps a board (raw JSON) in the cloud save shape the client uploads.
func save(user, board string) Save {
	return Save{User: user, Data: []byte(`{"version":3,"coins":1,"profile":{"v":1,"board":` + board + `}}`)}
}

// score is one valid board entry; extra is spliced in as more fields.
func score(floor, clockMs int, extra string) string {
	s := fmt.Sprintf(`{"floor":%d,"clockMs":%d,"mode":"free","date":"2026-10-25","seed":7,"species":"zorua","level":12`, floor, clockMs)
	if extra != "" {
		s += "," + extra
	}
	return s + "}"
}

func board(entries ...string) string { return "[" + strings.Join(entries, ",") + "]" }

var profiles = map[string]Profile{
	"a": {Nickname: "Ana", AvatarSpecies: "zorua"},
	"b": {Nickname: "Bea", AvatarSpecies: "gastly"},
	"c": {Nickname: "Cris"},
}

type row struct {
	nick  string
	floor int64
	clock int64
}

func rows(entries []Entry) []row {
	out := make([]row, len(entries))
	for i, e := range entries {
		out[i] = row{e.Nickname, e.Floor, e.ClockMs}
	}
	return out
}

func TestBuild(t *testing.T) {
	for _, tt := range []struct {
		name  string
		saves []Save
		tier  string
		want  []row
	}{
		{
			name:  "best entry per player, deeper first then more time left",
			saves: []Save{save("a", board(score(5, 100, ""), score(9, 10, ""))), save("b", board(score(9, 50, ""))), save("c", board(score(3, 0, "")))},
			tier:  "easy",
			want:  []row{{"Bea", 9, 50}, {"Ana", 9, 10}, {"Cris", 3, 0}},
		},
		{
			name:  "a score without difficulty counts as easy",
			saves: []Save{save("a", board(score(4, 0, ""))), save("b", board(score(6, 0, `"difficulty":"easy"`)))},
			tier:  "easy",
			want:  []row{{"Bea", 6, 0}, {"Ana", 4, 0}},
		},
		{
			name:  "each tier keeps its own board",
			saves: []Save{save("a", board(score(9, 0, `"difficulty":"hard"`), score(2, 0, ""))), save("b", board(score(5, 0, `"difficulty":"normal"`)))},
			tier:  "hard",
			want:  []row{{"Ana", 9, 0}},
		},
		{
			name:  "daily and free runs both count",
			saves: []Save{save("a", board(score(4, 0, `"mode":"daily"`)))},
			tier:  "easy",
			want:  []row{{"Ana", 4, 0}},
		},
		{
			name:  "a player without a profile is skipped",
			saves: []Save{save("ghost", board(score(20, 0, ""))), save("a", board(score(1, 0, "")))},
			tier:  "easy",
			want:  []row{{"Ana", 1, 0}},
		},
		{
			name: "malformed entries are skipped, the rest of the board counts",
			saves: []Save{save("a", board(
				`"not an object"`,
				`{"floor":"9","clockMs":0,"mode":"free","date":"2026-10-25","seed":1,"species":"zorua","level":1}`,
				score(8, 0, `"floor":-1`),
				`{"floor":7.5,"clockMs":0,"mode":"free","date":"2026-10-25","seed":1,"species":"zorua","level":1}`,
				`{"floor":0,"clockMs":0,"mode":"free","date":"2026-10-25","seed":1,"species":"zorua","level":1}`,
				`{"floor":6,"clockMs":-1,"mode":"free","date":"2026-10-25","seed":1,"species":"zorua","level":1}`,
				`{"floor":6,"clockMs":0,"mode":"ranked","date":"2026-10-25","seed":1,"species":"zorua","level":1}`,
				`{"floor":6,"clockMs":0,"mode":"free","date":"25/10/2026","seed":1,"species":"zorua","level":1}`,
				`{"floor":6,"clockMs":0,"mode":"free","date":"2026-10-25","seed":1,"species":"Zorua!","level":1}`,
				`{"floor":6,"clockMs":0,"mode":"free","date":"2026-10-25","seed":1,"species":"zorua","level":0}`,
				`{"floor":6,"clockMs":0,"mode":"free","date":"2026-10-25","seed":1,"species":"zorua","level":1,"difficulty":"legend"}`,
				`{"floor":6,"clockMs":0,"mode":"free","date":"2026-10-25","seed":1,"species":"zorua","level":1,"difficulty":3}`,
				`{"floor":99999999999999999999,"clockMs":0,"mode":"free","date":"2026-10-25","seed":1,"species":"zorua","level":1}`,
				score(2, 5, ""),
			))},
			tier: "easy",
			want: []row{{"Ana", 2, 5}},
		},
		{
			name: "malformed saves and boards are skipped",
			saves: []Save{
				{User: "a", Data: []byte(`not json`)},
				{User: "b", Data: []byte(`{"profile":{"board":{"floor":9}}}`)},
				{User: "c", Data: []byte(`{"profile":"nope"}`)},
			},
			tier: "easy",
			want: []row{},
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got := rows(Build(tt.saves, profiles, tt.tier))
			if fmt.Sprint(got) != fmt.Sprint(tt.want) {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBuildFillsThePublicFieldsAndRanks(t *testing.T) {
	got := Build([]Save{save("a", board(score(9, 1234, `"mode":"daily","build":"x"`))), save("b", board(score(3, 0, "")))}, profiles, "easy")
	want := []Entry{
		{Rank: 1, Nickname: "Ana", AvatarSpecies: "zorua", Floor: 9, ClockMs: 1234, Species: "zorua", Level: 12, Mode: "daily", Date: "2026-10-25"},
		{Rank: 2, Nickname: "Bea", AvatarSpecies: "gastly", Floor: 3, ClockMs: 0, Species: "zorua", Level: 12, Mode: "free", Date: "2026-10-25"},
	}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("got %+v, want %+v", got, want)
	}
}

func TestBuildKeepsTheTopFifty(t *testing.T) {
	var saves []Save
	nicks := map[string]Profile{}
	for i := range 60 {
		id := fmt.Sprintf("u%02d", i)
		nicks[id] = Profile{Nickname: id}
		saves = append(saves, save(id, board(score(i+1, 0, ""))))
	}
	got := Build(saves, nicks, "easy")
	if len(got) != Size {
		t.Fatalf("got %d entries, want %d", len(got), Size)
	}
	if got[0].Floor != 60 || got[0].Rank != 1 || got[Size-1].Floor != 11 || got[Size-1].Rank != Size {
		t.Fatalf("first %+v, last %+v", got[0], got[Size-1])
	}
}

func TestIsTier(t *testing.T) {
	for _, tier := range []string{"easy", "normal", "hard", "nightmare"} {
		if !IsTier(tier) {
			t.Errorf("%q should be a tier", tier)
		}
	}
	for _, tier := range []string{"", "Easy", "legend"} {
		if IsTier(tier) {
			t.Errorf("%q should not be a tier", tier)
		}
	}
	if DefaultTier != "easy" {
		t.Errorf("DefaultTier = %q, want easy (the client DEFAULT_DIFFICULTY)", DefaultTier)
	}
}
