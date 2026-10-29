#!/usr/bin/env sh
# Renders one exported bug report (collection `reports`) as a GitHub issue
# body in Markdown, on stdout. Offline: no network, no token, no secrets.
# The `client` hash and internal ids are left out on purpose.
#
# Usage:
#   tools/report-to-issue.sh report.json > body.md
#   gh issue create --repo FullFran/shadow-dungeon --title "[SD-XXXXXX] ..." --body-file body.md
#
# report.json is a single record, or the records API list answer
# ({"items":[...]}), in which case the first item is used. Needs jq.
set -eu

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
	echo "usage: $0 <report.json>" >&2
	exit 2
fi
command -v jq >/dev/null 2>&1 || {
	echo "report-to-issue: jq is required" >&2
	exit 2
}

jq -r '
	(if type == "object" and has("items") then .items[0] else . end) as $r
	| if $r == null then error("no report in the file") else . end
	| def field($k): ($r[$k] // "" | tostring | if . == "" then "_(empty)_" else . end);
	"Player report **\($r.ref // "?")** (category: \($r.category // "?")), received \(($r.created // "") | .[0:10]).\n"
	+ "\n### Description\n\(field("description"))\n"
	+ "\n### Steps to reproduce\n\(field("steps"))\n"
	+ "\n### Expected\n\(field("expected"))\n"
	+ "\n### Observed\n\(field("observed"))\n"
	+ "\n### Environment\n- Game version: \(field("version"))\n- Device: \(field("device"))\n"
	+ (if ($r.diagnostics // null) == null or $r.diagnostics == "" then ""
	   else "\n<details><summary>Diagnostics</summary>\n\n```json\n\($r.diagnostics | tojson)\n```\n</details>\n" end)
' "$1"
