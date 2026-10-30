# Admin tickets panel

Objective: the owner and designated admins triage player reports inside the game, and hear about new ones by email. Branch `feat/admin-tickets`. Delivery: `ask-on-risk`. Runners: `go test ./...` in `server/`, `npx vitest`.

## Specs

- S1 Log L1: only designated admins read and triage reports; the check lives on the server and fails closed.
- S2 Admins live in a server-side list only superusers edit; "u otros que designe admins" (L1). The client carries no list and no email; it asks the server.
- S3 In-game inbox: list, filter by status, search, detail. Status moves between new, triaged and closed; "issue" stays manual.
- S4 Email to each admin per new report (approved 2026-10-30), bounded per day so a flood cannot use up the verification-mail quota.
- S5 Player text stays inert in the panel and the email. The client hash and the raw report rows are never exposed to the client.
- S6 Intake, admin routes and mail are separate packages wired only in `server/main.go`; existing report intake behaviour does not change (L3).
- Assumption: the panel row lives in Options on the title, next to "Reportar un problema".

## Tasks

- T1 S1, S2, S3, S5, S6 backend admin routes and `admins` collection. Inline. Risk: item 2. Done, f10edc4.
- T2 S4, S6 report mail. Inline. Done, f10edc4.
- T3 S3, S5 client adapter, screen, Options row, i18n. Inline. Done, 0686eb6.
- T4 docs, independent verification, deploy (needs the owner's go-ahead; seeds the first admin).

Route evidence: no Writer trigger (single behaviour, sequential). Verification trigger fires on item 2.

## Parity checklist

- [x] i18n es and en for every new string (`tests/app/tickets-screen.test.ts`).
- [x] `server/README.md` routes, triage and how to add an admin.
- [x] GDD: mention of the panel next to the report entry.
- [ ] Save, sim, prove, net protocol, co-op: not touched (no game state involved); checked by the gate.

## Log

- L1 2026-10-30 owner: "podemos tener un panel de admin que lo vea solo yo al iniciar sesion en mazmorra sombria con franciscomanuelolmedocortes@gmail.com? u otros que designe admins"
- L2 2026-10-30 owner approved the GDR-style plan, email included: "hazlo"
- L3 2026-10-30 owner: "asegurate de seguir bien la arquitectura y que las dependencias esten bien, los distintos concerns y asi evitamos que tocando una cosa rompamos otra"
- L4 Design change from the proposal: routes under `/api/sd/admin` with an explicit guard instead of opening `reports` API rules. `reports` stays closed to the records API, so the existing test and default-deny hold; projection keeps the client hash out.
- L5 2026-10-30 end-to-end run: real Go server (temp dir) and real Firefox, as a plain player and as an admin; inert markup, search, close, reload all passed. Mail not sent for real yet (no SMTP locally).
