// Package hooks binds the game rules from package rules to PocketBase events.
package hooks

import (
	"database/sql"
	"errors"
	"net/http"

	validation "github.com/pocketbase/ozzo-validation/v4"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"

	"github.com/fullfran/mazmorra-sombria/server/internal/rules"
)

// Register binds every Shadow Dungeon hook to the app.
func Register(app core.App) {
	app.OnRecordValidate("saves").BindFunc(validateSave)
	app.OnRecordValidate("profiles").BindFunc(validateProfile)

	app.OnRecordCreateRequest("saves").BindFunc(createSave)
	app.OnRecordUpdateRequest("saves").BindFunc(updateSave)

	app.OnRecordCreateRequest("users").BindFunc(signUp)
	app.OnRecordUpdateRequest("users").BindFunc(keepAccountFlags)
	app.OnRecordAuthWithOAuth2Request("users").BindFunc(dropProviderEmail)
}

// signUp requires an email for a password account (the field is optional
// because OAuth2 accounts have none) and keeps the address private and the
// account unverified: only a verification email may verify it, and there is
// no SMTP yet. PocketBase itself rejects short passwords and taken emails.
func signUp(e *core.RecordRequestEvent) error {
	if e.HasSuperuserAuth() {
		return e.Next()
	}
	info, err := e.RequestInfo()
	if err != nil {
		return err
	}
	if info.Context != core.RequestInfoContextOAuth2 && e.Record.Email() == "" {
		return validation.Errors{core.FieldNameEmail: validation.NewError("validation_required", "Cannot be blank.")}
	}
	e.Record.SetEmailVisibility(false)
	e.Record.SetVerified(false)
	return e.Next()
}

// keepAccountFlags stops an owner from publishing their email or marking
// their own account verified; superusers can still change both.
func keepAccountFlags(e *core.RecordRequestEvent) error {
	if e.HasSuperuserAuth() {
		return e.Next()
	}
	e.Record.SetEmailVisibility(false)
	e.Record.SetVerified(e.Record.Original().Verified())
	return e.Next()
}

// conflictError carries the stored save out of the transaction so the
// handler can answer 409 with it and the client can resolve the conflict.
type conflictError struct{ current *core.Record }

func (conflictError) Error() string { return "save revision conflict" }

func validateSave(e *core.RecordEvent) error {
	data := []byte(e.Record.GetString("data"))
	if err := rules.ValidateSave(data, e.Record.GetInt("version")); err != nil {
		field := "data"
		if errors.Is(err, rules.ErrUnknownVersion) {
			field = "version"
		}
		return validation.Errors{field: validation.NewError("validation_invalid_save", err.Error())}
	}
	return e.Next()
}

func validateProfile(e *core.RecordEvent) error {
	if err := rules.ValidateNickname(e.Record.GetString("nickname")); err != nil {
		return validation.Errors{"nickname": validation.NewError("validation_invalid_nickname", err.Error())}
	}
	return e.Next()
}

// createSave treats a missing save as revision 0: the first write must send
// rev 0, and a second "first write" gets 409 with the save that already exists.
func createSave(e *core.RecordRequestEvent) error {
	incoming, err := incomingRev(e)
	if err != nil {
		return err
	}

	err = e.App.RunInTransaction(func(tx core.App) error {
		// Look only for the caller's own save; the create rule rejects any other user.
		if e.Auth != nil && e.Record.GetString("user") == e.Auth.Id {
			current, err := tx.FindFirstRecordByData(e.Collection, "user", e.Auth.Id)
			if err == nil {
				return conflictError{current}
			}
			if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
		}

		next, ok := rules.NextRev(0, incoming)
		if !ok {
			return apis.NewBadRequestError("A new save must start from rev 0.", nil)
		}
		e.Record.Set("rev", next)
		e.App = tx
		return e.Next()
	})
	return answerConflict(e, err)
}

// updateSave re-reads the stored rev inside the write transaction (PocketBase
// has a single writer connection), so two concurrent writes cannot both win.
func updateSave(e *core.RecordRequestEvent) error {
	incoming, err := incomingRev(e)
	if err != nil {
		return err
	}

	err = e.App.RunInTransaction(func(tx core.App) error {
		current, err := tx.FindRecordById(e.Collection, e.Record.Id)
		if err != nil {
			return err
		}

		next, ok := rules.NextRev(current.GetInt("rev"), incoming)
		if !ok {
			return conflictError{current}
		}
		e.Record.Set("rev", next)
		e.App = tx
		return e.Next()
	})
	return answerConflict(e, err)
}

// incomingRev requires the client to say which revision it edited.
func incomingRev(e *core.RecordRequestEvent) (int, error) {
	info, err := e.RequestInfo()
	if err != nil {
		return 0, err
	}
	if _, ok := info.Body["rev"]; !ok {
		return 0, apis.NewBadRequestError("Missing rev: send the revision this save is based on.", nil)
	}
	return e.Record.GetInt("rev"), nil
}

func answerConflict(e *core.RecordRequestEvent, err error) error {
	var conflict conflictError
	if !errors.As(err, &conflict) {
		return err
	}
	if err := apis.EnrichRecord(e.RequestEvent, conflict.current); err != nil {
		return err
	}
	return e.JSON(http.StatusConflict, map[string]any{
		"status":  http.StatusConflict,
		"message": "The save changed on the server; resolve against data.current.",
		"data":    map[string]any{"current": conflict.current},
	})
}

// dropProviderEmail keeps no provider email address: an OAuth2 account is
// identified by the provider's user id alone (stored in _externalAuths).
// Without an email PocketBase never links a provider to an existing account
// by matching addresses, so an unverified password account cannot be taken
// over through a provider that reports the same email. Linking happens only
// when the request carries the signed-in user's token: PocketBase then links
// the provider to that account instead of creating a new one.
// It also ignores client-sent createData, as users have no custom fields.
func dropProviderEmail(e *core.RecordAuthWithOAuth2RequestEvent) error {
	if e.OAuth2User != nil {
		e.OAuth2User.Email = ""
	}
	e.CreateData = nil
	return e.Next()
}
