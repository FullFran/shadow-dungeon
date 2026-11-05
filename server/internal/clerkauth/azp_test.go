package clerkauth

import "testing"

// A session token minted for another site (its azp claim) must not sign in here;
// a token with no azp (Clerk omits it outside browsers) is left to the signature.
func TestAuthorizedParty(t *testing.T) {
	allowed := authorizedParty([]string{"https://sd-pre.fullfran.com", " http://localhost:5173/ "})
	cases := map[string]bool{
		"https://sd-pre.fullfran.com":  true,
		"https://sd-pre.fullfran.com/": true,
		"http://localhost:5173":        true,
		"":                             true,
		"https://evil.example":         false,
		"https://www.fullfran.com":     false,
	}
	for azp, want := range cases {
		if got := allowed(azp); got != want {
			t.Errorf("azp %q: got %v, want %v", azp, got, want)
		}
	}
}

func TestFromEnvWithoutKeyIsNil(t *testing.T) {
	if v := FromEnv(func(string) string { return "" }, []string{"https://www.fullfran.com"}); v != nil {
		t.Fatalf("want nil verifier without CLERK_SECRET_KEY, got %T", v)
	}
}
