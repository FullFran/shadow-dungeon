package setup

import (
	"testing"

	"github.com/pocketbase/pocketbase/tests"
)

func env(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

func TestBackupsFromEnv(t *testing.T) {
	if b := backupsFromEnv(env(nil)); b.Set || b.S3Enabled() || b.Cron != DefaultBackupCron || b.Keep != DefaultBackupKeep || b.Region != "auto" {
		t.Fatalf("defaults: %+v", b)
	}
	full := backupsFromEnv(env(map[string]string{
		"SD_BACKUP_S3_ENDPOINT":   "https://acc.r2.cloudflarestorage.com",
		"SD_BACKUP_S3_BUCKET":     "sd-backups",
		"SD_BACKUP_S3_ACCESS_KEY": "ak",
		"SD_BACKUP_S3_SECRET":     " sk ",
		"SD_BACKUP_KEEP":          "30",
	}))
	if !full.Set || !full.S3Enabled() || full.S3Partial() || full.Keep != 30 || full.Secret != "sk" || full.Cron != DefaultBackupCron {
		t.Fatalf("full: %+v", full)
	}
	partial := backupsFromEnv(env(map[string]string{"SD_BACKUP_S3_BUCKET": "sd-backups"}))
	if !partial.Set || partial.S3Enabled() || !partial.S3Partial() {
		t.Fatalf("partial: %+v", partial)
	}
	if b := backupsFromEnv(env(map[string]string{"SD_BACKUP_KEEP": "-3", "SD_BACKUP_CRON": "0 3 * * *"})); b.Keep != DefaultBackupKeep || b.Cron != "0 3 * * *" {
		t.Fatalf("bad keep: %+v", b)
	}
}

func TestApplyBackups(t *testing.T) {
	app, err := tests.NewTestApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()
	s := app.Settings()

	// Nothing in the environment: settings made in the dashboard stay.
	s.Backups.Cron = "1 1 * * *"
	applyBackups(s, backupsFromEnv(env(nil)))
	if s.Backups.Cron != "1 1 * * *" {
		t.Fatalf("untouched expected, got %q", s.Backups.Cron)
	}

	applyBackups(s, backupsFromEnv(env(map[string]string{
		"SD_BACKUP_S3_ENDPOINT": "https://acc.r2.cloudflarestorage.com", "SD_BACKUP_S3_BUCKET": "sd-backups",
		"SD_BACKUP_S3_ACCESS_KEY": "ak", "SD_BACKUP_S3_SECRET": "sk",
	})))
	if s.Backups.Cron != DefaultBackupCron || s.Backups.CronMaxKeep != DefaultBackupKeep || !s.Backups.S3.Enabled || s.Backups.S3.Bucket != "sd-backups" || s.Backups.S3.Region != "auto" {
		t.Fatalf("s3: %+v", s.Backups)
	}
	if err := s.Backups.Validate(); err != nil {
		t.Fatalf("PocketBase rejects the backup settings: %v", err)
	}

	// A half-set bucket keeps the daily backup, local only.
	applyBackups(s, backupsFromEnv(env(map[string]string{"SD_BACKUP_S3_BUCKET": "sd-backups"})))
	if s.Backups.S3.Enabled || s.Backups.Cron != DefaultBackupCron {
		t.Fatalf("partial: %+v", s.Backups)
	}
}
