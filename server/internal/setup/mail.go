package setup

import (
	"strconv"

	"github.com/pocketbase/pocketbase/core"
)

// Mail defaults. Resend SMTP: host smtp.resend.com, port 465 with implicit TLS,
// user "resend", password = an API key with sending access only.
const (
	DefaultSMTPPort = 465
	DefaultMailName = "Mazmorra Sombría"
	DefaultAppName  = "Mazmorra Sombría"
	DefaultAppURL   = "https://sd-api.fullfran.com"
)

// Mail is the outgoing email configuration.
type Mail struct {
	Host        string
	Port        int
	Username    string
	Password    string
	TLS         bool
	FromAddress string
	FromName    string
	AppURL      string // public API URL used in the links of the emails
	AppName     string
}

// SMTPEnabled reports whether there is enough to send email: a host, a
// password and a sender address. Anything less keeps SMTP off.
func (m Mail) SMTPEnabled() bool {
	return m.Host != "" && m.Password != "" && m.FromAddress != ""
}

// SMTPPartial reports a half-configured SMTP (some values set, SMTP still off),
// so the server can warn about it at start.
func (m Mail) SMTPPartial() bool {
	return !m.SMTPEnabled() && (m.Host != "" || m.Password != "" || m.FromAddress != "")
}

func mailFromEnv(getenv func(string) string) Mail {
	m := Mail{
		Host:        getenv("SD_SMTP_HOST"),
		Port:        DefaultSMTPPort,
		Username:    getenv("SD_SMTP_USERNAME"),
		Password:    getenv("SD_SMTP_PASSWORD"),
		FromAddress: getenv("SD_MAIL_FROM_ADDRESS"),
		FromName:    orDefault(getenv("SD_MAIL_FROM_NAME"), DefaultMailName),
		AppURL:      orDefault(getenv("SD_APP_URL"), DefaultAppURL),
		AppName:     orDefault(getenv("SD_APP_NAME"), DefaultAppName),
	}
	if port, err := strconv.Atoi(getenv("SD_SMTP_PORT")); err == nil && port > 0 {
		m.Port = port
	}
	// Port 465 needs implicit TLS; other ports (587) default to STARTTLS.
	m.TLS = m.Port == 465
	if tls, err := strconv.ParseBool(getenv("SD_SMTP_TLS")); err == nil {
		m.TLS = tls
	}
	return m
}

// applyMail writes SMTP and sender settings. It does not save them.
func applyMail(settings *core.Settings, m Mail) {
	settings.Meta.AppName = orDefault(m.AppName, DefaultAppName)
	settings.Meta.AppURL = orDefault(m.AppURL, DefaultAppURL)
	settings.Meta.SenderName = orDefault(m.FromName, DefaultMailName)
	if m.FromAddress != "" {
		settings.Meta.SenderAddress = m.FromAddress
	}
	if !m.SMTPEnabled() {
		settings.SMTP = core.SMTPConfig{}
		return
	}
	settings.SMTP = core.SMTPConfig{
		Enabled:  true,
		Host:     m.Host,
		Port:     m.Port,
		Username: m.Username,
		Password: m.Password,
		TLS:      m.TLS,
	}
}

// applyMailTemplates writes the bilingual email templates of the users
// collection. It does not save it. The new-login alert stays off: players on
// mobile networks change IP often and would get one on almost every login.
func applyMailTemplates(users *core.Collection) {
	users.VerificationTemplate = VerificationTemplate
	users.ResetPasswordTemplate = ResetPasswordTemplate
	users.ConfirmEmailChangeTemplate = EmailChangeTemplate
	users.OTP.EmailTemplate = OTPTemplate
	users.AuthAlert.EmailTemplate = AuthAlertTemplate
	users.AuthAlert.Enabled = false
}

// The links point at PocketBase's built-in confirmation pages under /_/,
// which work for any auth collection and need no page in the game.
const (
	verifyLink      = core.EmailPlaceholderAppURL + "/_/#/auth/confirm-verification/" + core.EmailPlaceholderToken
	resetLink       = core.EmailPlaceholderAppURL + "/_/#/auth/confirm-password-reset/" + core.EmailPlaceholderToken
	emailChangeLink = core.EmailPlaceholderAppURL + "/_/#/auth/confirm-email-change/" + core.EmailPlaceholderToken
	appName         = core.EmailPlaceholderAppName
)

// bilingual is a short Spanish paragraph, an optional button and the same in English.
func bilingual(es, en, href, label string) string {
	body := "<p>" + es + "</p>\n"
	if href != "" {
		body += `<p><a class="btn" href="` + href + `" target="_blank" rel="noopener">` + label + "</a></p>\n"
	}
	return body + "<hr>\n<p>" + en + "</p>\n<p>" + appName + "</p>"
}

// Email templates of the users collection, in Spanish and English.
var (
	VerificationTemplate = core.EmailTemplate{
		Subject: "Confirma tu email / Confirm your email · " + appName,
		Body: bilingual(
			"¡Hola! Gracias por crear tu cuenta en "+appName+". Pulsa el botón para confirmar tu email. Si no has sido tú, ignora este mensaje.",
			"Hi! Thanks for creating your "+appName+" account. Press the button to confirm your email. If it was not you, just ignore this message.",
			verifyLink, "Confirmar / Confirm"),
	}
	ResetPasswordTemplate = core.EmailTemplate{
		Subject: "Cambia tu contraseña / Reset your password · " + appName,
		Body: bilingual(
			"¡Hola! Alguien ha pedido cambiar la contraseña de tu cuenta en "+appName+". Pulsa el botón para elegir una nueva. Si no has sido tú, ignora este mensaje y tu contraseña seguirá igual.",
			"Hi! Someone asked to reset the password of your "+appName+" account. Press the button to choose a new one. If it was not you, just ignore this message and your password stays the same.",
			resetLink, "Nueva contraseña / New password"),
	}
	EmailChangeTemplate = core.EmailTemplate{
		Subject: "Confirma tu nuevo email / Confirm your new email · " + appName,
		Body: bilingual(
			"¡Hola! Pulsa el botón para usar esta dirección en tu cuenta de "+appName+". Si no has sido tú, ignora este mensaje.",
			"Hi! Press the button to use this address for your "+appName+" account. If it was not you, just ignore this message.",
			emailChangeLink, "Confirmar / Confirm"),
	}
	OTPTemplate = core.EmailTemplate{
		Subject: "Tu código / Your code · " + appName,
		Body: bilingual(
			"¡Hola! Tu código para entrar en "+appName+" es <strong>"+core.EmailPlaceholderOTP+"</strong>. Si no lo has pedido tú, ignora este mensaje.",
			"Hi! Your code to sign in to "+appName+" is <strong>"+core.EmailPlaceholderOTP+"</strong>. If you did not ask for it, just ignore this message.",
			"", ""),
	}
	AuthAlertTemplate = core.EmailTemplate{
		Subject: "Nuevo inicio de sesión / New sign-in · " + appName,
		Body: bilingual(
			"¡Hola! Alguien ha entrado en tu cuenta de "+appName+" desde un sitio nuevo: <em>"+core.EmailPlaceholderAlertInfo+"</em>. Si no has sido tú, cambia tu contraseña cuanto antes.",
			"Hi! Someone signed in to your "+appName+" account from a new place: <em>"+core.EmailPlaceholderAlertInfo+"</em>. If it was not you, change your password as soon as you can.",
			"", ""),
	}
)

func orDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
