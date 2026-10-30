package friends

import (
	"testing"
	"time"
)

func TestPairIsTheSameEitherWay(t *testing.T) {
	if Pair("a", "b") != Pair("b", "a") || Pair("a", "b") != "a:b" {
		t.Fatal(Pair("a", "b"), Pair("b", "a"))
	}
}

func TestCodes(t *testing.T) {
	for _, c := range []struct {
		code string
		want bool
	}{
		{"ACDEFHJK", true}, {"ACDEFHJ", false}, {"ACDEFHJKM", false}, {"acdefhjk", false},
		{"ACDEFHJ0", false}, {"ACDEFHJ ", false}, {"", false}, {"ACDEFHJK\n", false},
	} {
		if ValidCode(c.code) != c.want {
			t.Errorf("code %q", c.code)
		}
	}
	if !ValidRoom("K7M3A") || ValidRoom("K7M2Q") || ValidRoom("K7M3") || ValidRoom("") {
		t.Fatal("room")
	}
}

func TestState(t *testing.T) {
	now := time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC)
	for _, c := range []struct {
		name       string
		seen       time.Time
		room       string
		want, code string
	}{
		{"never seen", time.Time{}, "", StateOffline, ""},
		{"never seen with a room", time.Time{}, "K7M3A", StateOffline, ""},
		{"just now", now, "", StateOnline, ""},
		{"at the edge", now.Add(-OnlineWindow), "", StateOnline, ""},
		{"past the edge", now.Add(-OnlineWindow - time.Second), "", StateOffline, ""},
		{"in a room", now.Add(-time.Minute), "K7M3A", StateRoom, "K7M3A"},
		{"a stale room is hidden", now.Add(-OnlineWindow - time.Second), "K7M3A", StateOffline, ""},
	} {
		if state, code := State(c.seen, c.room, now); state != c.want || code != c.code {
			t.Errorf("%s: %s %q", c.name, state, code)
		}
	}
}
