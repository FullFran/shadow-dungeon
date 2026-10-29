// Package rules holds the pure validation rules of the Shadow Dungeon API:
// what a cloud save may contain, how its revision advances and what a
// public nickname may look like. Nothing here touches PocketBase, so every
// rule is covered by plain table-driven tests.
package rules

import (
	"bytes"
	"encoding/json"
	"errors"
	"math"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	// MaxSaveBytes is the largest accepted save payload (the raw JSON of `data`).
	MaxSaveBytes = 64 * 1024

	// MaxCoins is a sanity cap on the coin balance in a cloud save. The save
	// is still client-authoritative in v1; this only rejects absurd values.
	MaxCoins = 1_000_000_000

	// NicknameMax mirrors NICKNAME_MAX in src/net/nickname.ts.
	NicknameMax = 16

	// nicknameRawMax mirrors the `raw.slice(0, 256)` guard in the client.
	nicknameRawMax = 256
)

// The client SAVE_VERSION (src/app/save.ts) the server accepts: any whole
// number in this range, so the client can bump it without a server deploy.
const (
	MinSaveVersion = 1
	MaxSaveVersion = 99
)

var (
	ErrTooLarge        = errors.New("save data is larger than 64 KB")
	ErrNotObject       = errors.New("save data must be a JSON object")
	ErrUnknownVersion  = errors.New("save version must be a whole number from 1 to 99")
	ErrVersionMismatch = errors.New("data.version must equal the record version")
	ErrBadCoins        = errors.New("coins must be a whole number between 0 and the cap")

	ErrNicknameEmpty   = errors.New("nickname is required")
	ErrNicknameInvalid = errors.New("nickname must be at most 16 visible characters without control or invisible characters")
)

// ValidateSave checks the raw JSON of a cloud save and the record's version.
func ValidateSave(data []byte, version int) error {
	if len(data) > MaxSaveBytes {
		return ErrTooLarge
	}

	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	var save map[string]any
	if err := dec.Decode(&save); err != nil || save == nil {
		return ErrNotObject
	}

	if version < MinSaveVersion || version > MaxSaveVersion {
		return ErrUnknownVersion
	}
	if n, ok := wholeNumber(save["version"]); !ok || n != float64(version) {
		return ErrVersionMismatch
	}

	if n, ok := wholeNumber(save["coins"]); !ok || n < 0 || n > MaxCoins {
		return ErrBadCoins
	}

	return nil
}

// NextRev applies optimistic concurrency: a write must carry the revision it
// was based on. It returns the revision to store, or false on a conflict.
// A save that does not exist yet has revision 0.
func NextRev(stored, incoming int) (int, bool) {
	if incoming != stored {
		return 0, false
	}
	return stored + 1, true
}

// SanitizeNickname mirrors sanitizeNickname in src/net/nickname.ts:
// whitespace runs become one space, control, format, unassigned, private-use
// and surrogate characters go, and at most NicknameMax characters remain.
func SanitizeNickname(raw string) string {
	s := strings.ToValidUTF8(raw, "")
	s = truncateRunes(s, nicknameRawMax)
	s = collapseSpaces(s)
	s = strings.Map(func(r rune) rune {
		if isHiddenRune(r) {
			return -1
		}
		return r
	}, s)
	s = strings.TrimFunc(s, isJSSpace)
	return strings.TrimFunc(truncateRunes(s, NicknameMax), isJSSpace)
}

// ValidateNickname accepts only a nickname that is already clean: the
// client sanitizes before sending, so anything else is rejected, not fixed.
func ValidateNickname(nickname string) error {
	if strings.TrimFunc(nickname, isJSSpace) == "" {
		return ErrNicknameEmpty
	}
	if !utf8.ValidString(nickname) || SanitizeNickname(nickname) != nickname {
		return ErrNicknameInvalid
	}
	return nil
}

// wholeNumber reads a JSON number that has no fractional part.
func wholeNumber(v any) (float64, bool) {
	num, ok := v.(json.Number)
	if !ok {
		return 0, false
	}
	f, err := num.Float64()
	if err != nil || math.IsInf(f, 0) || f != math.Trunc(f) {
		return 0, false
	}
	return f, true
}

func truncateRunes(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	return string([]rune(s)[:max])
}

func collapseSpaces(s string) string {
	var b strings.Builder
	inSpace := false
	for _, r := range s {
		if isJSSpace(r) {
			if !inSpace {
				b.WriteRune(' ')
			}
			inSpace = true
			continue
		}
		inSpace = false
		b.WriteRune(r)
	}
	return b.String()
}

// isJSSpace matches the JavaScript `\s` class (WhiteSpace and LineTerminator).
func isJSSpace(r rune) bool {
	switch r {
	case '\t', '\n', '\v', '\f', '\r', ' ', '\u00a0', '\u1680', '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff':
		return true
	}
	return r >= '\u2000' && r <= '\u200a'
}

// isHiddenRune matches the Unicode categories Cc, Cf, Cn, Co and Cs.
func isHiddenRune(r rune) bool {
	if unicode.In(r, unicode.Cc, unicode.Cf, unicode.Co, unicode.Cs) {
		return true
	}
	assigned := unicode.In(r, unicode.L, unicode.M, unicode.N, unicode.P, unicode.S, unicode.Z)
	return !assigned
}
