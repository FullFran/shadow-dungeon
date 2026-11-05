package clerkauth

import (
	"context"
	"fmt"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwks"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/clerk/clerk-sdk-go/v2/user"
)

// verificationVerified is the status Clerk gives a confirmed email address.
const verificationVerified = "verified"

// FromEnv returns the Clerk verifier configured by CLERK_SECRET_KEY, or nil
// when the key is unset (the route then answers 503). Tokens must have been
// issued to one of origins (the CORS origins, SD_ALLOWED_ORIGINS).
func FromEnv(getenv func(string) string, origins []string) Verifier {
	key := strings.TrimSpace(getenv("CLERK_SECRET_KEY"))
	if key == "" {
		return nil
	}
	cfg := &clerk.ClientConfig{BackendConfig: clerk.BackendConfig{Key: &key}}
	return &sdkVerifier{jwks: jwks.NewClient(cfg), users: user.NewClient(cfg), azp: authorizedParty(origins)}
}

// authorizedParty accepts a token's azp claim when it is one of origins,
// ignoring case and a trailing slash. An absent azp passes, as Clerk advises:
// browsers always send it, and the signature still binds the token to this instance.
func authorizedParty(origins []string) jwt.AuthorizedPartyHandler {
	norm := func(s string) string { return strings.ToLower(strings.TrimRight(strings.TrimSpace(s), "/")) }
	allowed := make(map[string]bool, len(origins))
	for _, o := range origins {
		allowed[norm(o)] = true
	}
	return func(azp string) bool { return azp == "" || allowed[norm(azp)] }
}

// sdkVerifier checks tokens against the instance JWKS and reads the user from
// the Clerk Backend API, through the official Go SDK.
type sdkVerifier struct {
	jwks  *jwks.Client
	users *user.Client
	azp   jwt.AuthorizedPartyHandler
}

func (s *sdkVerifier) Verify(ctx context.Context, token string) (Identity, error) {
	claims, err := jwt.Verify(ctx, &jwt.VerifyParams{Token: token, JWKSClient: s.jwks, AuthorizedPartyHandler: s.azp})
	if err != nil {
		// A bad signature, an expired token and an unreachable JWKS look alike
		// here; only the first two are the caller's fault, but failing closed
		// with 401 is the safe answer for all of them.
		return Identity{}, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}
	u, err := s.users.Get(ctx, claims.Subject)
	if err != nil {
		return Identity{}, fmt.Errorf("get clerk user: %w", err)
	}
	id := Identity{UserID: u.ID}
	if u.PrimaryEmailAddressID == nil {
		return id, nil
	}
	for _, e := range u.EmailAddresses {
		if e != nil && e.ID == *u.PrimaryEmailAddressID {
			id.Email = e.EmailAddress
			id.EmailVerified = e.Verification != nil && e.Verification.Status == verificationVerified
		}
	}
	return id, nil
}
