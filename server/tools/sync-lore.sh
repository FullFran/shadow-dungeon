#!/usr/bin/env sh
# Copies the lore bible, its best practices, the lore graph and its offline
# viewer from the game repo into internal/lore/data/, where go:embed picks
# them up. Commit the result: the Docker build only sees this directory.
#
# Usage:
#   tools/sync-lore.sh [--repo PATH] [--ref REF]   # from a git ref (default docs/lore-bible)
#   tools/sync-lore.sh [--repo PATH] --worktree     # from the repo's working tree
#
# PATH defaults to $LORE_REPO or ../../mazmorra-sombria next to this checkout.
set -eu

here=$(cd "$(dirname "$0")/.." && pwd)
dest="$here/internal/lore/data"
repo=${LORE_REPO:-"$here/../../mazmorra-sombria"}
ref=docs/lore-bible
worktree=0

while [ $# -gt 0 ]; do
	case "$1" in
	--repo) repo=$2; shift 2 ;;
	--ref) ref=$2; shift 2 ;;
	--worktree) worktree=1; shift ;;
	-h | --help) sed -n '2,10p' "$0"; exit 0 ;;
	*) echo "unknown argument: $1" >&2; exit 2 ;;
	esac
done

git -C "$repo" rev-parse --git-dir >/dev/null 2>&1 || { echo "not a git repo: $repo" >&2; exit 1; }
files="lore.md buenas-practicas.md lore-graph.json lore-graph.html"
mkdir -p "$dest"

if [ "$worktree" = 1 ]; then
	commit=$(git -C "$repo" rev-parse HEAD)
	source_ref="worktree"
	if [ -n "$(git -C "$repo" status --porcelain -- docs/lore)" ]; then
		source_ref="worktree (uncommitted changes in docs/lore)"
	fi
	for f in $files; do
		cp "$repo/docs/lore/$f" "$dest/$f"
	done
else
	commit=$(git -C "$repo" rev-parse --verify "$ref^{commit}")
	source_ref=$ref
	for f in $files; do
		git -C "$repo" show "$commit:docs/lore/$f" >"$dest/$f"
	done
fi

# Only the source is recorded, never the sync time, so re-syncing the same
# commit leaves the tree unchanged.
printf '{\n  "ref": "%s",\n  "commit": "%s"\n}\n' "$source_ref" "$commit" >"$dest/source.json"
echo "synced lore from $source_ref @ $commit into $dest"
