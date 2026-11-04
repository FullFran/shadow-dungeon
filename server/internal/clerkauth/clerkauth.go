// Package clerkauth exchanges a Clerk session token for a PocketBase auth
// token, so Clerk is the identity provider and PocketBase stays the data store.
package clerkauth

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// authMethod is reported to PocketBase's auth hooks, like "password" or "oauth2".
const authMethod = "clerk"

// ErrInvalidToken is returned by a Verifier for a missing, forged or expired token.
var ErrInvalidToken = errors.New("invalid clerk session token")

// Identity is what the exchange needs to know about a signed-in Clerk user.
type Identity struct {
	UserID        string
	Email         string // primary email address, "" when none
	EmailVerified bool   // Clerk verified that address
}

// Verifier checks a Clerk session token and says who it belongs to.
type Verifier interface {
	Verify(ctx context.Context, token string) (Identity, error)
}

// Register adds `POST /api/sd/clerk/session` to r. A nil verifier (no Clerk
// key configured) makes the route answer 503.
func Register(r *router.Router[*core.RequestEvent], v Verifier) {
	r.POST("/api/sd/clerk/session", func(e *core.RequestEvent) error { return handle(e, v) })
}

func handle(e *core.RequestEvent, v Verifier) error {
	if v == nil {
		return apis.NewApiError(http.StatusServiceUnavailable, "Clerk sign-in is not configured on this server.", nil)
	}
	token, ok := bearer(e.Request.Header.Get("Authorization"))
	if !ok {
		return apis.NewUnauthorizedError("Missing Clerk session token.", nil)
	}
	id, err := v.Verify(e.Request.Context(), token)
	if errors.Is(err, ErrInvalidToken) {
		return apis.NewUnauthorizedError("Invalid or expired Clerk session token.", nil)
	}
	if err != nil {
		e.App.Logger().Error("clerk verification failed", "error", err)
		return apis.NewApiError(http.StatusBadGateway, "Could not reach Clerk.", nil)
	}
	email := strings.ToLower(strings.TrimSpace(id.Email))
	if id.UserID == "" || email == "" || !id.EmailVerified {
		return apis.NewApiError(http.StatusUnprocessableEntity, "The Clerk account needs a verified email address.", nil)
	}

	var user *core.Record
	err = e.App.RunInTransaction(func(tx core.App) error {
		var err error
		user, err = resolve(tx, id.UserID, email)
		return err
	})
	if err != nil {
		var apiErr *router.ApiError
		if errors.As(err, &apiErr) {
			return apiErr
		}
		e.App.Logger().Error("clerk session exchange failed", "error", err)
		return apis.NewApiError(http.StatusInternalServerError, "Could not sign in.", nil)
	}
	return apis.RecordAuthResponse(e, user, authMethod, nil)
}

// bearer extracts the token of an "Authorization: Bearer <token>" header.
func bearer(header string) (string, bool) {
	scheme, token, found := strings.Cut(strings.TrimSpace(header), " ")
	token = strings.TrimSpace(token)
	return token, found && strings.EqualFold(scheme, "Bearer") && token != ""
}

// resolve finds the account of a Clerk user: by clerk_id, else by the verified
// email (linking it), else a new one.
func resolve(app core.App, clerkID, email string) (*core.Record, error) {
	user, err := app.FindFirstRecordByData("users", "clerk_id", clerkID)
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	user, err = app.FindAuthRecordByEmail("users", email)
	if err == nil {
		if linked := user.GetString("clerk_id"); linked != "" && linked != clerkID {
			return nil, apis.NewApiError(http.StatusConflict, "That email belongs to an account linked to another Clerk user.", nil)
		}
		user.Set("clerk_id", clerkID)
		user.SetVerified(true)
		return user, app.Save(user)
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return nil, err
	}
	user = core.NewRecord(users)
	user.SetEmail(email)
	user.SetEmailVisibility(false)
	user.SetRandomPassword()
	user.SetVerified(true)
	user.Set("clerk_id", clerkID)
	return user, app.Save(user)
}
