#!/usr/bin/env bash
# Deploys the current branch to preproduction (https://sd-pre.fullfran.com).
#
# The server polls the `preprod` branch of FullFran/shadow-dungeon every 2 minutes and
# builds the game (npm run build, VITE_API_URL=https://sd-pre.fullfran.com) and the
# backend (server/). A failing build keeps the previous version. This script runs the
# project's deploy gate first, then fast-forwards `preprod` to the current commit.
#
# Usage: scripts/deploy-preprod.sh --yes [--skip-tests]
#   --yes         required: pushing publishes to the shared preprod environment.
#   --skip-tests  only typecheck + build (what the server itself checks); use when a
#                 known, unrelated test is red and say so in the hand-off.
set -euo pipefail

yes=0
skip_tests=0
for arg in "$@"; do
  case "$arg" in
    --yes) yes=1 ;;
    --skip-tests) skip_tests=1 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
if [[ $yes -ne 1 ]]; then
  echo "Refusing to push without --yes (preprod is shared with the owner)." >&2
  exit 2
fi

cd "$(git rev-parse --show-toplevel)"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean: commit or stash first." >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
git fetch origin preprod main

# preprod must stay a fast-forward of what is already there: bring it into the branch first.
if ! git merge-base --is-ancestor origin/preprod HEAD; then
  echo "origin/preprod has commits this branch lacks. Merge it first:" >&2
  echo "  git merge origin/preprod" >&2
  exit 1
fi

echo "==> Deploy gate on $branch ($(git rev-parse --short HEAD))"
npm run typecheck
if [[ $skip_tests -eq 0 ]]; then
  npx vitest run --testTimeout=30000
  npm run prove
fi
VITE_API_URL=https://sd-pre.fullfran.com npm run build

echo "==> Pushing $branch to origin/preprod"
git push origin "HEAD:preprod"
echo "Done. The server picks it up within ~2 minutes: https://sd-pre.fullfran.com (Cloudflare Access login)."
