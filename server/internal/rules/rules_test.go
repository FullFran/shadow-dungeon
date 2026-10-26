package rules

import (
	"errors"
	"strings"
	"testing"
)

func TestValidateSave(t *testing.T) {
	big := `{"version":3,"coins":0,"pad":"` + strings.Repeat("x", MaxSaveBytes) + `"}`

	cases := []struct {
		name    string
		data    string
		version int
		want    error
	}{
		{"minimal v3 save", `{"version":3,"coins":0,"upgrades":{}}`, 3, nil},
		{"full v3 save", `{"version":3,"coins":120,"upgrades":{"hp":2},"owned":["zorua"],"pity":4}`, 3, nil},
		{"older known version", `{"version":2,"coins":5}`, 2, nil},
		{"coins at the cap", `{"version":3,"coins":1000000000}`, 3, nil},
		{"oversize payload", big, 3, ErrTooLarge},
		{"array is not an object", `[1,2,3]`, 3, ErrNotObject},
		{"null is not an object", `null`, 3, ErrNotObject},
		{"string is not an object", `"save"`, 3, ErrNotObject},
		{"invalid json", `{"coins":`, 3, ErrNotObject},
		{"empty payload", ``, 3, ErrNotObject},
		{"unknown version", `{"version":99,"coins":0}`, 99, ErrUnknownVersion},
		{"version zero", `{"coins":0}`, 0, ErrUnknownVersion},
		{"data version differs from record version", `{"version":2,"coins":0}`, 3, ErrVersionMismatch},
		{"data version missing", `{"coins":0}`, 3, ErrVersionMismatch},
		{"coins missing", `{"version":3}`, 3, ErrBadCoins},
		{"negative coins", `{"version":3,"coins":-1}`, 3, ErrBadCoins},
		{"fractional coins", `{"version":3,"coins":1.5}`, 3, ErrBadCoins},
		{"coins as string", `{"version":3,"coins":"10"}`, 3, ErrBadCoins},
		{"coins over the cap", `{"version":3,"coins":1000000001}`, 3, ErrBadCoins},
		{"huge coins", `{"version":3,"coins":1e300}`, 3, ErrBadCoins},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ValidateSave([]byte(tc.data), tc.version)
			if !errors.Is(got, tc.want) {
				t.Fatalf("ValidateSave() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestNextRev(t *testing.T) {
	cases := []struct {
		name     string
		stored   int
		incoming int
		want     int
		wantOK   bool
	}{
		{"first write", 0, 0, 1, true},
		{"matching rev advances", 7, 7, 8, true},
		{"stale rev", 7, 6, 0, false},
		{"rev from the future", 7, 8, 0, false},
		{"negative rev", 0, -1, 0, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := NextRev(tc.stored, tc.incoming)
			if got != tc.want || ok != tc.wantOK {
				t.Fatalf("NextRev(%d, %d) = (%d, %v), want (%d, %v)", tc.stored, tc.incoming, got, ok, tc.want, tc.wantOK)
			}
		})
	}
}

func TestSanitizeNickname(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want string
	}{
		{"plain", "Fran", "Fran"},
		{"trims", "  Fran  ", "Fran"},
		{"collapses whitespace runs", "Dark\t\n  Lord", "Dark Lord"},
		{"drops control characters", "Fr\x00an\x07", "Fran"},
		{"drops zero-width space", "Fr\u200ban", "Fran"},
		{"drops bidi override", "\u202eFran", "Fran"},
		{"drops private use", "Fran\ue000", "Fran"},
		{"keeps accents and emoji", "\u00cd\u00f1igo \U0001f47b", "\u00cd\u00f1igo \U0001f47b"},
		{"keeps 16 characters", "abcdefghijklmnopqrstuvwxyz", "abcdefghijklmnop"},
		{"trims after truncation", "abcdefghijklmno pq", "abcdefghijklmno"},
		{"only invisible", "\u200b\u200d", ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := SanitizeNickname(tc.raw); got != tc.want {
				t.Fatalf("SanitizeNickname(%q) = %q, want %q", tc.raw, got, tc.want)
			}
		})
	}
}

func TestValidateNickname(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want error
	}{
		{"clean", "Fran", nil},
		{"sixteen characters", "abcdefghijklmnop", nil},
		{"empty", "", ErrNicknameEmpty},
		{"blank", "   ", ErrNicknameEmpty},
		{"seventeen characters", "abcdefghijklmnopq", ErrNicknameInvalid},
		{"leading space", " Fran", ErrNicknameInvalid},
		{"zero-width joiner", "Fr\u200dan", ErrNicknameInvalid},
		{"invalid utf-8", "Fr\xffan", ErrNicknameInvalid},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ValidateNickname(tc.raw); !errors.Is(got, tc.want) {
				t.Fatalf("ValidateNickname(%q) = %v, want %v", tc.raw, got, tc.want)
			}
		})
	}
}
