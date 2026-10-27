package lore

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

// Normalize folds text for matching: lower case, accents and other
// combining marks removed (NFD), anything that is not a letter or a digit
// turned into a single space. «Cráneo» and "craneo" fold to the same string.
func Normalize(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	space := true
	for _, r := range norm.NFD.String(s) {
		switch {
		case unicode.Is(unicode.Mn, r):
			continue
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(unicode.ToLower(r))
			space = false
		default:
			if !space {
				b.WriteByte(' ')
				space = true
			}
		}
	}
	return strings.TrimSpace(b.String())
}

// stopwords are Spanish (and a few English) function words that carry no
// lore on their own, already normalized.
var stopwords = map[string]bool{}

func init() {
	for _, w := range strings.Fields(`a al algo ante asi aun como con contra cual cuando de del desde donde
		durante e el ella ellas ellos en entre era eran es esa esas ese eso esos esta estan estas este esto
		estos fue fueron ha han hasta hay la las le les lo los mas me mi mis muy ni no nos o os otra otro
		para pero poco por porque que quien se sea segun ser si sin sobre son su sus tambien te tiene
		tienen todo tras tu tus un una unas uno unos ya y yo sabemos dice dicen sabe hace
		the of and or to in is are what who`) {
		stopwords[w] = true
	}
}

// stem is a deliberately light Spanish plural fold: "sombras" and "sombra"
// share a term, as do "eclipses" and "eclipse". Short words are kept.
func stem(w string) string {
	if len(w) > 4 && strings.HasSuffix(w, "s") {
		return w[:len(w)-1]
	}
	return w
}

// Terms returns the indexable terms of s: normalized, stopwords dropped,
// lightly stemmed. Order and repeats are kept (term frequency counts them).
func Terms(s string) []string {
	words := strings.Fields(Normalize(s))
	out := words[:0]
	for _, w := range words {
		if stopwords[w] {
			continue
		}
		out = append(out, stem(w))
	}
	return out
}

// containsPhrase reports whether the normalized phrase occurs in the
// normalized text on word boundaries.
func containsPhrase(text, phrase string) bool {
	if phrase == "" {
		return false
	}
	padded := " " + text + " "
	return strings.Contains(padded, " "+phrase+" ")
}
