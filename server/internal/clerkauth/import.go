package clerkauth

import (
	"context"
	"fmt"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/user"
	"github.com/pocketbase/pocketbase/core"
	"github.com/spf13/cobra"
)

// Directory is the part of the Clerk user list the import needs.
type Directory interface {
	// Exists says whether a Clerk user already has this email address.
	Exists(ctx context.Context, email string) (bool, error)
	// Create adds a Clerk user with a verified email and this bcrypt password hash.
	Create(ctx context.Context, email, digest string) error
}

// Report is what an import did (or, in a dry run, would do).
type Report struct {
	Created    []string // created in Clerk with their PocketBase password
	InClerk    []string // already a Clerk user: their first sign-in links them by email
	Failed     []string // Clerk refused them; the others went on
	Linked     int      // already linked (clerk_id set): skipped
	Unverified int      // email never verified here: skipped, so nobody claims an address they do not own
}

// Import copies every verified PocketBase password account without a Clerk
// link into Clerk, with its bcrypt hash, so a player keeps signing in with the
// same email and password once the client signs in through Clerk. It never
// writes to PocketBase: the session exchange links each account by email on
// its first sign-in. With apply false nothing is sent (a dry run).
func Import(ctx context.Context, app core.App, dir Directory, apply bool) (Report, error) {
	rows := []struct {
		Email    string `db:"email"`
		Password string `db:"password"`
		Verified bool   `db:"verified"`
		ClerkID  string `db:"clerk_id"`
	}{}
	if err := app.DB().NewQuery("SELECT email, password, verified, clerk_id FROM users ORDER BY created, id").All(&rows); err != nil {
		return Report{}, fmt.Errorf("read users: %w", err)
	}
	var report Report
	for _, r := range rows {
		email := strings.ToLower(strings.TrimSpace(r.Email))
		switch {
		case r.ClerkID != "":
			report.Linked++
			continue
		case !r.Verified || email == "":
			report.Unverified++
			continue
		}
		exists, err := dir.Exists(ctx, email)
		if err != nil {
			return report, fmt.Errorf("look up a Clerk user: %w", err)
		}
		if exists {
			report.InClerk = append(report.InClerk, email)
			continue
		}
		if apply {
			if err := dir.Create(ctx, email, r.Password); err != nil {
				app.Logger().Error("clerk import failed", "email", email, "error", err)
				report.Failed = append(report.Failed, email)
				continue
			}
		}
		report.Created = append(report.Created, email)
	}
	return report, nil
}

// sdkDirectory is the Clerk Backend API through the official SDK.
type sdkDirectory struct{ users *user.Client }

// DirectoryFromEnv returns the Clerk user list of CLERK_SECRET_KEY, or nil when it is unset.
func DirectoryFromEnv(getenv func(string) string) Directory {
	key := strings.TrimSpace(getenv("CLERK_SECRET_KEY"))
	if key == "" {
		return nil
	}
	return sdkDirectory{users: user.NewClient(&clerk.ClientConfig{BackendConfig: clerk.BackendConfig{Key: &key}})}
}

func (d sdkDirectory) Exists(ctx context.Context, email string) (bool, error) {
	list, err := d.users.List(ctx, &user.ListParams{EmailAddresses: []string{email}})
	if err != nil {
		return false, err
	}
	return list.TotalCount > 0, nil
}

func (d sdkDirectory) Create(ctx context.Context, email, digest string) error {
	hasher, skip := "bcrypt", true
	_, err := d.users.Create(ctx, &user.CreateParams{
		EmailAddresses:     &[]string{email},
		PasswordDigest:     &digest,
		PasswordHasher:     &hasher,
		SkipPasswordChecks: &skip,
	})
	return err
}

// ImportCommand is `clerk-import [--apply]`: a dry run by default, which lists
// what --apply would create in the Clerk instance of CLERK_SECRET_KEY.
func ImportCommand(app core.App, getenv func(string) string) *cobra.Command {
	var apply bool
	cmd := &cobra.Command{
		Use:   "clerk-import",
		Short: "Copy verified password accounts into Clerk (dry run unless --apply)",
		RunE: func(cmd *cobra.Command, _ []string) error {
			dir := DirectoryFromEnv(getenv)
			if dir == nil {
				return fmt.Errorf("CLERK_SECRET_KEY is not set")
			}
			report, err := Import(cmd.Context(), app, dir, apply)
			verb := "would create"
			if apply {
				verb = "created"
			}
			out := cmd.OutOrStdout()
			fmt.Fprintf(out, "%s %d, already in Clerk %d, failed %d, already linked %d, unverified skipped %d\n",
				verb, len(report.Created), len(report.InClerk), len(report.Failed), report.Linked, report.Unverified)
			for _, e := range report.Failed {
				fmt.Fprintf(out, "failed: %s\n", e)
			}
			return err
		},
	}
	cmd.Flags().BoolVar(&apply, "apply", false, "create the users in Clerk (without it, only report)")
	return cmd
}
