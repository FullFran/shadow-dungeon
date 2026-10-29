package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"

	"github.com/fullfran/mazmorra-sombria/server/internal/reports"
)

func init() {
	m.Register(createReports, dropReports)
}

// createReports adds the players' bug reports (issue #9). Every API rule
// stays nil: only superusers read them in the dashboard, and the game creates
// them only through POST /api/sd/reports, which validates, throttles and
// hashes the client IP. Nothing personal is stored.
func createReports(app core.App) error {
	c := core.NewBaseCollection(reports.Collection)
	c.ListRule = nil
	c.ViewRule = nil
	c.CreateRule = nil
	c.UpdateRule = nil
	c.DeleteRule = nil

	c.Fields.Add(
		&core.TextField{Name: "ref", Required: true, Max: 9, Pattern: reports.RefPattern},
		&core.SelectField{Name: "category", Required: true, MaxSelect: 1, Values: reports.Categories},
		&core.TextField{Name: "description", Required: true, Max: reports.MaxDescription},
		&core.TextField{Name: "steps", Max: reports.MaxSteps},
		&core.TextField{Name: "expected", Max: reports.MaxExpected},
		&core.TextField{Name: "observed", Max: reports.MaxObserved},
		&core.TextField{Name: "version", Max: reports.MaxVersion},
		&core.TextField{Name: "device", Max: reports.MaxDevice},
		&core.JSONField{Name: "diagnostics", MaxSize: reports.MaxDiagnosticsBytes},
		&core.TextField{Name: "client", Max: 64},
		&core.SelectField{Name: "status", Required: true, MaxSelect: 1, Values: reports.Statuses},
		&core.URLField{Name: "githubIssue", OnlyDomains: []string{"github.com"}},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	c.AddIndex("idx_reports_ref", true, "ref", "")
	c.AddIndex("idx_reports_created", false, "created", "")
	return app.Save(c)
}

func dropReports(app core.App) error {
	c, err := app.FindCollectionByNameOrId(reports.Collection)
	if err != nil {
		return err
	}
	return app.Delete(c)
}
