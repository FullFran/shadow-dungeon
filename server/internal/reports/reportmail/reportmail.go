// Package reportmail tells the admins about a new player report by email.
// It is plain text, so what a player typed cannot act as markup. Sending never
// holds up or fails the report: it runs apart, and a failure is only logged.
package reportmail

import (
	"fmt"
	"net/mail"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/mailer"
	"github.com/pocketbase/pocketbase/tools/routine"
	"github.com/pocketbase/pocketbase/tools/types"

	"github.com/fullfran/mazmorra-sombria/server/internal/reports"
)

// DailyLimit is how many reports per UTC day send mail. Past it they still
// wait in the inbox: a flood must not spend the quota that account
// verification emails share.
const DailyLimit = 20

// New answers the function that announces a report to every admin. Nothing is
// sent while SMTP is off.
func New(app core.App, now func() time.Time) func(reports.Notice) {
	return func(n reports.Notice) {
		if !app.Settings().SMTP.Enabled || overLimit(app, now()) {
			return
		}
		from := mail.Address{Name: app.Settings().Meta.SenderName, Address: app.Settings().Meta.SenderAddress}
		for _, to := range recipients(app) {
			message := &mailer.Message{From: from, To: []mail.Address{{Address: to}}, Subject: subject(n), Text: body(n)}
			routine.FireAndForget(func() {
				// No ref in the log: the request log keeps the IP, and the two must not be joined by time.
				if err := app.NewMailClient().Send(message); err != nil {
					app.Logger().Error("reports: announcing a report failed", "error", err)
				}
			})
		}
	}
}

// overLimit counts today's reports, the one being announced included. It
// refuses when the count cannot be read: mail is the part that can wait.
func overLimit(app core.App, at time.Time) bool {
	at = at.UTC()
	start := time.Date(at.Year(), at.Month(), at.Day(), 0, 0, 0, 0, time.UTC)
	n, err := app.CountRecords(reports.Collection, dbx.NewExp("created >= {:start}", dbx.Params{"start": start.Format(types.DefaultDateLayout)}))
	if err != nil {
		app.Logger().Error("reports: counting today's reports failed", "error", err)
		return true
	}
	return n > DailyLimit
}

func recipients(app core.App) []string {
	admins, err := app.FindAllRecords(reports.AdminsCollection)
	if err != nil {
		app.Logger().Error("reports: reading the admins failed", "error", err)
		return nil
	}
	out := make([]string, 0, len(admins))
	for _, a := range admins {
		u, err := app.FindRecordById("users", a.GetString("user"))
		if err != nil || u.Email() == "" {
			continue
		}
		out = append(out, u.Email())
	}
	return out
}

func subject(n reports.Notice) string {
	return fmt.Sprintf("Nuevo ticket %s (%s)", n.Ref, n.Category)
}

func body(n reports.Notice) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Ticket %s, tipo %s.\n", n.Ref, n.Category)
	for _, field := range []struct{ label, value string }{
		{"Qué ha pasado", n.Description},
		{"Cómo repetirlo", n.Steps},
		{"Qué esperaba", n.Expected},
		{"Qué vio", n.Observed},
		{"Versión", n.Version},
		{"Dispositivo", n.Device},
	} {
		if field.value != "" {
			fmt.Fprintf(&b, "\n%s:\n%s\n", field.label, field.value)
		}
	}
	b.WriteString("\nPuedes verlo y clasificarlo en el juego: Opciones > Tickets.\n")
	return b.String()
}
