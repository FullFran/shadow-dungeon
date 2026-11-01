package setup

import (
	"strconv"
	"strings"

	"github.com/pocketbase/pocketbase/core"
)

// DefaultBackupCron is when the automatic backup runs: daily at 04:00 UTC.
const DefaultBackupCron = "0 4 * * *"

// DefaultBackupKeep is how many automatic backups are kept.
const DefaultBackupKeep = 14

// Backups is PocketBase's automatic backup, read from SD_BACKUP_* (server
// README, Backups). Off-site storage is any S3-compatible bucket, such as
// Cloudflare R2; it is used only when all four S3 values are set.
type Backups struct {
	// Set is true when any SD_BACKUP_* value is present; otherwise the backup
	// settings are left as they are (they may have been set in the dashboard).
	Set       bool
	Cron      string
	Keep      int
	Endpoint  string
	Bucket    string
	Region    string
	AccessKey string
	Secret    string
	PathStyle bool
}

// S3Enabled reports whether every value an S3 bucket needs is set.
func (b Backups) S3Enabled() bool {
	return b.Endpoint != "" && b.Bucket != "" && b.AccessKey != "" && b.Secret != ""
}

// S3Partial reports whether some but not all S3 values are set (backups then stay local).
func (b Backups) S3Partial() bool {
	any := b.Endpoint != "" || b.Bucket != "" || b.AccessKey != "" || b.Secret != ""
	return any && !b.S3Enabled()
}

func backupsFromEnv(getenv func(string) string) Backups {
	get := func(k string) string { return strings.TrimSpace(getenv(k)) }
	b := Backups{
		Cron:      get("SD_BACKUP_CRON"),
		Keep:      DefaultBackupKeep,
		Endpoint:  get("SD_BACKUP_S3_ENDPOINT"),
		Bucket:    get("SD_BACKUP_S3_BUCKET"),
		Region:    get("SD_BACKUP_S3_REGION"),
		AccessKey: get("SD_BACKUP_S3_ACCESS_KEY"),
		Secret:    get("SD_BACKUP_S3_SECRET"),
		PathStyle: get("SD_BACKUP_S3_PATH_STYLE") == "true",
	}
	keep := get("SD_BACKUP_KEEP")
	if n, err := strconv.Atoi(keep); err == nil && n > 0 {
		b.Keep = n
	}
	b.Set = b.Cron != "" || keep != "" || b.Endpoint != "" || b.Bucket != "" || b.AccessKey != "" || b.Secret != ""
	if b.Cron == "" {
		b.Cron = DefaultBackupCron
	}
	if b.Region == "" {
		b.Region = "auto"
	}
	return b
}

func applyBackups(settings *core.Settings, b Backups) {
	if !b.Set {
		return
	}
	settings.Backups.Cron = b.Cron
	settings.Backups.CronMaxKeep = b.Keep
	settings.Backups.S3 = core.S3Config{}
	if b.S3Enabled() {
		settings.Backups.S3 = core.S3Config{
			Enabled:        true,
			Endpoint:       b.Endpoint,
			Bucket:         b.Bucket,
			Region:         b.Region,
			AccessKey:      b.AccessKey,
			Secret:         b.Secret,
			ForcePathStyle: b.PathStyle,
		}
	}
}
