// Package reportsadmin lets the designated admins triage the players' reports
// from the game. Every route goes through one guard: a player account listed
// in the admins collection, which only superusers edit. Reports stay closed to
// the records API, and these routes answer only the fields below, so the
// stored client hash never leaves the server (server/README.md, "Bug reports").
package reportsadmin

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"slices"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"

	"github.com/fullfran/mazmorra-sombria/server/internal/reports"
)

// ListLimit is the most reports one list answers.
const ListLimit = 200

const maxPatchBytes = 1 << 10

var validRef = regexp.MustCompile(reports.RefPattern)

// Register adds the admin routes to r.
func Register(r *router.Router[*core.RequestEvent], app core.App) {
	g := r.Group("/api/sd/admin")
	g.Bind(apis.RequireAuth("users"))
	g.BindFunc(requireAdmin)
	g.GET("/me", me)
	g.GET("/reports", list)
	g.PATCH("/reports/{ref}", setStatus)
}

// requireAdmin fails closed: anything but finding the account in the list refuses.
func requireAdmin(e *core.RequestEvent) error {
	e.Response.Header().Set("Cache-Control", "no-store")
	if _, err := e.App.FindFirstRecordByData(reports.AdminsCollection, "user", e.Auth.Id); err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			e.App.Logger().Error("reports admin: reading the admins failed", "error", err)
		}
		return e.ForbiddenError("", nil)
	}
	return e.Next()
}

func me(e *core.RequestEvent) error {
	return e.JSON(http.StatusOK, map[string]bool{"admin": true})
}

// item is what an admin sees of a report; the client hash stays out.
func item(r *core.Record) map[string]any {
	return map[string]any{
		"ref":         r.GetString("ref"),
		"created":     r.GetDateTime("created").String(),
		"category":    r.GetString("category"),
		"status":      r.GetString("status"),
		"description": r.GetString("description"),
		"steps":       r.GetString("steps"),
		"expected":    r.GetString("expected"),
		"observed":    r.GetString("observed"),
		"version":     r.GetString("version"),
		"device":      r.GetString("device"),
		"diagnostics": r.Get("diagnostics"),
		"githubIssue": r.GetString("githubIssue"),
	}
}

func list(e *core.RequestEvent) error {
	status := e.Request.URL.Query().Get("status")
	if status != "" && !slices.Contains(reports.Statuses, status) {
		return e.BadRequestError("unknown status", nil)
	}
	filter, params, conditions := "", dbx.Params{}, []dbx.Expression{}
	if status != "" {
		filter, params["status"] = "status = {:status}", status
		conditions = append(conditions, dbx.HashExp{"status": status})
	}
	records, err := e.App.FindRecordsByFilter(reports.Collection, filter, "-created", ListLimit, 0, params)
	if err != nil {
		return e.InternalServerError("", err)
	}
	total, err := e.App.CountRecords(reports.Collection, conditions...)
	if err != nil {
		return e.InternalServerError("", err)
	}
	items := make([]map[string]any, 0, len(records))
	for _, r := range records {
		items = append(items, item(r))
	}
	return e.JSON(http.StatusOK, map[string]any{"items": items, "total": total})
}

func setStatus(e *core.RequestEvent) error {
	ref := e.Request.PathValue("ref")
	if !validRef.MatchString(ref) {
		return e.NotFoundError("", nil)
	}
	raw, err := io.ReadAll(io.LimitReader(e.Request.Body, maxPatchBytes+1))
	if err != nil || len(raw) > maxPatchBytes {
		return e.BadRequestError("malformed body", nil)
	}
	var body struct {
		Status string `json:"status"`
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil || dec.More() {
		return e.BadRequestError("malformed body", nil)
	}
	if !slices.Contains(reports.TriageStatuses, body.Status) {
		return e.BadRequestError("unknown status", nil)
	}
	r, err := e.App.FindFirstRecordByData(reports.Collection, "ref", ref)
	if err != nil {
		return e.NotFoundError("", nil)
	}
	r.Set("status", body.Status)
	if err := e.App.Save(r); err != nil {
		return e.InternalServerError("", err)
	}
	return e.JSON(http.StatusOK, item(r))
}
