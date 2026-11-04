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
// when the key is unset (the route then answers 503).
func FromEnv(getenv func(string) string) Verifier {
	key := strings.TrimSpace(getenv("CLERK_SECRET_KEY"))
	if key == "" {
		return nil
	}
	cfg := &clerk.ClientConfig{BackendConfig: clerk.BackendConfig{Key: &key}}
	return &sdkVerifier{jwks: jwks.NewClient(cfg), users: user.NewClient(cfg)}
}

// sdkVerifier checks tokens against the instance JWKS and reads the user from
// the Clerk Backend API, through the official Go SDK.
type sdkVerifier struct {
	jwks  *jwks.Client
	users *user.Client
}

func (s *sdkVerifier) Verify(ctx context.Context, token string) (Identity, error) {
	claims, err := jwt.Verify(ctx, &jwt.VerifyParams{Token: token, JWKSClient: s.jwks})
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
