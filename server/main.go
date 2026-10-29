// Command server is the Shadow Dungeon API: PocketBase used as a Go
// framework, with the game's collections, hooks and settings.
package main

import (
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"github.com/fullfran/mazmorra-sombria/server/internal/hooks"
	"github.com/fullfran/mazmorra-sombria/server/internal/lore"
	"github.com/fullfran/mazmorra-sombria/server/internal/lore/loreapi"
	"github.com/fullfran/mazmorra-sombria/server/internal/ranking/rankingapi"
	"github.com/fullfran/mazmorra-sombria/server/internal/setup"
	"github.com/fullfran/mazmorra-sombria/server/internal/turn/turnapi"
	_ "github.com/fullfran/mazmorra-sombria/server/migrations"
)

func main() {
	cfg := setup.FromEnv(setup.Getenv)
	turn := turnapi.FromEnv(setup.Getenv)
	os.Args = setup.WithOrigins(os.Args, cfg.Origins)

	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultEncryptionEnv: "PB_ENCRYPTION_KEY",
	})

	// Schema changes live in Go migrations; never generate them from the dashboard.
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{Automigrate: false})

	hooks.Register(app)

	// The lore is embedded; a broken copy stops the server here, not later.
	loreIndex, err := lore.Load()
	if err != nil {
		log.Fatal(err)
	}

	// Migrations have run by now (apis.Serve applies them before OnServe).
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		if err := setup.Apply(e.App, cfg); err != nil {
			return err
		}
		// Public, read-only lore pages and API (owner decision 2026-10-27).
		if err := loreapi.Register(e.Router, loreIndex); err != nil {
			return err
		}
		// Public Sima ranking, derived from the cloud saves (nicknames only).
		rankingapi.Register(e.Router, e.App)
		// Short-lived TURN relay credentials for co-op (Cloudflare Realtime); none without a key.
		turnapi.Register(e.Router, turn)
		names := make([]string, 0, len(cfg.Providers))
		for _, p := range cfg.Providers {
			names = append(names, p.Name)
		}
		e.App.Logger().Info("shadow dungeon api configured",
			"origins", cfg.Origins, "oauth2Providers", names, "rateLimits", cfg.RateLimits,
			"smtp", cfg.Mail.SMTPEnabled(), "appURL", cfg.Mail.AppURL,
			"loreVersion", loreIndex.Version, "loreCommit", loreIndex.Source.Commit, "turn", turn.Configured())
		if cfg.Mail.SMTPPartial() {
			e.App.Logger().Warn("SMTP stays off: set SD_SMTP_HOST, SD_SMTP_PASSWORD and SD_MAIL_FROM_ADDRESS")
		}
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
