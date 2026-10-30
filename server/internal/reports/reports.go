// Package reports holds the shape of a player's bug report (issue #9): its
// collection name, categories, statuses and field limits, shared by the
// migration that creates the collection, the route that fills it, the admin
// routes that triage it and the mail that announces it.
package reports

// Collection is the PocketBase collection that stores the reports.
const Collection = "reports"

// RefPattern is the public reference a player can quote: SD- and 6 characters.
const RefPattern = `^SD-[A-Z0-9]{6}$`

// Field limits, in characters (diagnostics in bytes).
const (
	MaxDescription      = 2000
	MaxSteps            = 2000
	MaxExpected         = 1000
	MaxObserved         = 1000
	MaxVersion          = 40
	MaxDevice           = 200
	MaxDiagnosticsBytes = 16 << 10
)

// Categories a player can pick, in form order.
var Categories = []string{"bug", "online", "performance", "interface", "progress", "suggestion", "other"}

// Statuses the owner moves a report through while triaging it.
var Statuses = []string{"new", "triaged", "issue", "closed"}

// StatusNew is where every report starts.
const StatusNew = "new"

// TriageStatuses are the ones an admin sets from the game; "issue" goes with
// a GitHub link, which the owner sets by hand.
var TriageStatuses = []string{StatusNew, "triaged", "closed"}

// AdminsCollection lists the accounts allowed to triage reports. Only
// superusers edit it.
const AdminsCollection = "admins"

// Notice is what a new report announces to whoever is told about it.
type Notice struct {
	Ref, Category, Description, Steps, Expected, Observed, Version, Device string
}
