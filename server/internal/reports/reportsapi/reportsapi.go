// Package reportsapi receives the players' bug reports from the game
// (issue #9). Reports are anonymous: the route keeps only what the player
// typed, a coarse device summary, the game version and a hash of the client
// IP for spotting floods; never the IP, an email or an account id. Nothing
// becomes public: the owner triages them in the dashboard and opens GitHub
// issues by hand (server/README.md, "Bug reports").
package reportsapi

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
	"github.com/pocketbase/pocketbase/tools/types"

	"github.com/fullfran/mazmorra-sombria/server/internal/reports"
)

// Collection is where the reports are stored.
const Collection = reports.Collection

// Limits re-exported for callers and tests.
const (
	MaxDescription      = reports.MaxDescription
	MaxExpected         = reports.MaxExpected
	MaxDiagnosticsBytes = reports.MaxDiagnosticsBytes
)

// MaxBodyBytes is the largest request body the route reads.
const MaxBodyBytes = 32 << 10

// DailyCap is how many reports the server stores per UTC day across all
// clients (each client is also limited per IP by the "/api/sd/reports"
// rate-limit rule). Past it the route answers 503, so a flood cannot fill
// the disk or bury the real reports.
const DailyCap = 200

// refAlphabet is what a ref is drawn from; refs identify, they are not secrets.
const refAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

// Body is the JSON the game posts. Website is a honeypot no human sees.
type Body struct {
	Category    string          `json:"category"`
	Description string          `json:"description"`
	Steps       string          `json:"steps"`
	Expected    string          `json:"expected"`
	Observed    string          `json:"observed"`
	Version     string          `json:"version"`
	Device      string          `json:"device"`
	Diagnostics json.RawMessage `json:"diagnostics"`
	Website     string          `json:"website"`
}

type fieldError struct {
	Error string `json:"error"`
	Field string `json:"field,omitempty"`
}

type api struct {
	app      core.App
	dailyCap int
	now      func() time.Time
}

// Register adds `POST /api/sd/reports` to r.
func Register(r *router.Router[*core.RequestEvent], app core.App) {
	register(r, app, DailyCap, time.Now)
}

func register(r *router.Router[*core.RequestEvent], app core.App, dailyCap int, now func() time.Time) {
	a := &api{app: app, dailyCap: dailyCap, now: now}
	r.POST("/api/sd/reports", a.create)
}

func (a *api) create(e *core.RequestEvent) error {
	e.Response.Header().Set("Cache-Control", "no-store")
	raw, err := io.ReadAll(io.LimitReader(e.Request.Body, MaxBodyBytes+1))
	if err != nil {
		return e.JSON(http.StatusBadRequest, fieldError{Error: "unreadable body"})
	}
	if len(raw) > MaxBodyBytes {
		return e.JSON(http.StatusRequestEntityTooLarge, fieldError{Error: "report too large"})
	}
	var body Body
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil || dec.More() {
		return e.JSON(http.StatusBadRequest, fieldError{Error: "malformed report"})
	}

	// A filled honeypot is a bot: let it believe it worked and keep nothing.
	if strings.TrimSpace(body.Website) != "" {
		return e.JSON(http.StatusCreated, map[string]string{"ref": newRef()})
	}

	clean, ferr := validate(body)
	if ferr != nil {
		return e.JSON(http.StatusBadRequest, ferr)
	}

	full, err := a.capReached()
	if err != nil {
		e.App.Logger().Error("reports: counting today's reports failed", "error", err)
		return e.JSON(http.StatusServiceUnavailable, fieldError{Error: "reports are unavailable right now, try again later"})
	}
	if full {
		e.App.Logger().Warn("reports: daily cap reached", "dailyCap", a.dailyCap)
		return e.JSON(http.StatusServiceUnavailable, fieldError{Error: "too many reports today, try again tomorrow"})
	}

	ref, err := a.store(clean, clientHash(e.RealIP()))
	if err != nil {
		e.App.Logger().Error("reports: storing failed", "error", err)
		return e.JSON(http.StatusServiceUnavailable, fieldError{Error: "reports are unavailable right now, try again later"})
	}
	e.App.Logger().Info("report received", "ref", ref, "category", clean.Category)
	return e.JSON(http.StatusCreated, map[string]string{"ref": ref})
}

// validate trims every field, strips control characters and checks limits.
// It answers the first offending field.
func validate(b Body) (Body, *fieldError) {
	out := Body{
		Category:    strings.TrimSpace(b.Category),
		Description: cleanText(b.Description, true),
		Steps:       cleanText(b.Steps, true),
		Expected:    cleanText(b.Expected, true),
		Observed:    cleanText(b.Observed, true),
		Version:     cleanText(b.Version, false),
		Device:      cleanText(b.Device, false),
	}
	if !slices.Contains(reports.Categories, out.Category) {
		return out, &fieldError{Error: "unknown category", Field: "category"}
	}
	if out.Description == "" {
		return out, &fieldError{Error: "description is required", Field: "description"}
	}
	for _, f := range []struct {
		name, value string
		max         int
	}{
		{"description", out.Description, reports.MaxDescription},
		{"steps", out.Steps, reports.MaxSteps},
		{"expected", out.Expected, reports.MaxExpected},
		{"observed", out.Observed, reports.MaxObserved},
		{"version", out.Version, reports.MaxVersion},
		{"device", out.Device, reports.MaxDevice},
	} {
		if utf8.RuneCountInString(f.value) > f.max {
			return out, &fieldError{Error: f.name + " is too long", Field: f.name}
		}
	}
	diag := bytes.TrimSpace(b.Diagnostics)
	if len(diag) > 0 && !bytes.Equal(diag, []byte("null")) {
		if len(diag) > reports.MaxDiagnosticsBytes {
			return out, &fieldError{Error: "diagnostics too large", Field: "diagnostics"}
		}
		var obj map[string]any
		if json.Unmarshal(diag, &obj) != nil {
			return out, &fieldError{Error: "diagnostics must be an object", Field: "diagnostics"}
		}
		compact := &bytes.Buffer{}
		if json.Compact(compact, diag) != nil {
			return out, &fieldError{Error: "diagnostics must be an object", Field: "diagnostics"}
		}
		out.Diagnostics = compact.Bytes()
	}
	return out, nil
}

// cleanText trims s and drops control characters; multiline keeps newlines and tabs.
func cleanText(s string, multiline bool) string {
	s = strings.ToValidUTF8(s, "")
	s = strings.Map(func(r rune) rune {
		if r == '\r' {
			return -1
		}
		if multiline && (r == '\n' || r == '\t') {
			return r
		}
		if unicode.IsControl(r) {
			if !multiline && (r == '\n' || r == '\t') {
				return ' '
			}
			return -1
		}
		return r
	}, s)
	return strings.TrimSpace(s)
}

// capReached reports whether today's (UTC) reports already hit the cap.
func (a *api) capReached() (bool, error) {
	now := a.now().UTC()
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	end := start.Add(24 * time.Hour)
	n, err := a.app.CountRecords(Collection, dbx.NewExp("created >= {:start} AND created < {:end}", dbx.Params{
		"start": start.Format(types.DefaultDateLayout),
		"end":   end.Format(types.DefaultDateLayout),
	}))
	if err != nil {
		return false, err
	}
	return int(n) >= a.dailyCap, nil
}

// store saves the report, retrying with a fresh ref on the rare collision.
func (a *api) store(b Body, client string) (string, error) {
	col, err := a.app.FindCollectionByNameOrId(Collection)
	if err != nil {
		return "", err
	}
	for attempt := 0; attempt < 5; attempt++ {
		ref := newRef()
		if _, err := a.app.FindFirstRecordByData(Collection, "ref", ref); err == nil {
			continue
		}
		r := core.NewRecord(col)
		r.Load(map[string]any{
			"ref":         ref,
			"category":    b.Category,
			"description": b.Description,
			"steps":       b.Steps,
			"expected":    b.Expected,
			"observed":    b.Observed,
			"version":     b.Version,
			"device":      b.Device,
			"client":      client,
			"status":      reports.StatusNew,
		})
		if len(b.Diagnostics) > 0 {
			r.Set("diagnostics", types.JSONRaw(b.Diagnostics))
		}
		if err := a.app.Save(r); err != nil {
			return "", err
		}
		return ref, nil
	}
	return "", errors.New("no free reference after 5 attempts")
}

// newRef draws SD- plus 6 characters from crypto/rand.
func newRef() string {
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		panic(err) // crypto/rand never fails on supported platforms
	}
	out := make([]byte, 6)
	for i, b := range buf {
		out[i] = refAlphabet[int(b)%len(refAlphabet)]
	}
	return "SD-" + string(out)
}

// clientHash tells repeat reporters apart without keeping their IP.
func clientHash(ip string) string {
	sum := sha256.Sum256([]byte("sd-report:" + ip))
	return hex.EncodeToString(sum[:6])
}
