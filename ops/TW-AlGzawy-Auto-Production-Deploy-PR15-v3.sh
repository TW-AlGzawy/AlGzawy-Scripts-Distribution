#!/usr/bin/env bash
# TW-AlGzawy-Auto — deploy reviewed PR #15 merge to the existing Hetzner Runner.
# No schema reset, no git reset/clean, no .env rewrite, no tunnel restart. Operator has tested troop recall.
set -Eeuo pipefail
EXPECTED_SHA='e046bb3bbbc878cf8b68b76753f03a3cd741bcd3'
BACKUPS='/root/tw-algzawy-production-backups'
trap 'echo "DEPLOY FAILED near line ${LINENO}. Inspect output; never reset the data directory." >&2' ERR

repos=()
while IFS= read -r compose_file; do
  candidate="$(dirname "$(dirname "$compose_file")")"
  remote="$(git -C "$candidate" remote get-url origin 2>/dev/null || true)"
  case "$remote" in
    *TW-AlGzawy/TW-AlGzawy-Auto*) repos+=("$candidate") ;;
  esac
done < <(find /root /opt /srv /home /var/www /app -maxdepth 7 -type f -path '*/runner/docker-compose.yml' -print 2>/dev/null || true)

if (( ${#repos[@]} != 1 )); then
  printf 'Expected exactly one authenticated TW-AlGzawy-Auto deployment; found %s. Stopping.\n' "${#repos[@]}" >&2
  exit 2
fi
repo="${repos[0]}"
cd "$repo"

if [[ "$(git branch --show-current)" != 'main' ]]; then
  echo 'Current checkout is not main. Stopping rather than switching a production branch.' >&2
  exit 2
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo 'Tracked production files have local changes. Stopping to protect them.' >&2
  exit 2
fi
if [[ ! -f runner/.env || ! -d runner/data ]]; then
  echo 'Required runner/.env or runner/data is missing. Stopping.' >&2
  exit 2
fi
# The owner has confirmed live troop recall. Keep the exact .env unchanged, including TROOPS_RECALL=1.
echo 'Preserving existing .env and TROOPS_RECALL setting without modification.'
command -v docker >/dev/null || { echo 'Docker is missing' >&2; exit 2; }
docker compose version >/dev/null

echo 'Fetching the reviewed production commit...'
git fetch origin main
if [[ "$(git rev-parse origin/main)" != "$EXPECTED_SHA" ]]; then
  echo 'Remote main changed after review. Stopping to avoid deploying unreviewed changes.' >&2
  exit 2
fi
previous_sha="$(git rev-parse HEAD)"
mkdir -p -m 700 "$BACKUPS"
chmod 700 "$BACKUPS"
backup="$BACKUPS/runner-before-pr15-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
echo 'Creating restricted backup of runner/.env and runner/data...'
tar -czf "$backup" -C "$repo/runner" .env data
chmod 600 "$backup"

echo "Backup created: $backup"
echo "Previous checkout: $previous_sha"
echo 'Fast-forwarding production checkout...'
git merge --ff-only origin/main
cd runner
docker compose config --quiet

echo 'Building updated runner while the existing container is still running...'
docker compose build runner

echo 'Recreating runner container; tunnel service is not changed...'
docker compose up -d --no-deps runner

echo 'Checking container and local runner health...'
docker compose ps runner
docker compose exec -T runner node -e '
const http = require("node:http");
http.get("http://127.0.0.1:8787/health", r => {
  let body = "";
  r.on("data", chunk => { body += chunk; });
  r.on("end", () => {
    let j; try { j = JSON.parse(body); } catch { console.error("Invalid health response"); process.exitCode = 1; return; }
    console.log("Runner health:", JSON.stringify(j));
    if (r.statusCode !== 200 || j.ok !== true || j.restore === "blocked") process.exitCode = 1;
    if (j.restore === "initializing") console.log("Session recovery is still in progress; verify again later before relying on the bots.");
  });
}).on("error", e => { console.error(e.message); process.exitCode = 1; });'
echo "Done. Commit: $(git -C "$repo" rev-parse HEAD)"
echo "Recovery backup (contains secrets — keep private): $backup"
