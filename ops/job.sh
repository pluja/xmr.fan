#!/bin/sh
# Runs one scheduled job on the server: pull, run it in the jobs container, commit the data it changed, push, redeploy.
#   ops/job.sh weekly | publish | donations | nodes | heights
# Started by the systemd timers in ops/systemd/. Failures are reported to NOTIFY_URL (ntfy).
set -eu
cd "$(dirname "$0")/.."
job="${1:?usage: ops/job.sh weekly|publish|donations|nodes|heights}"

if [ -f .env ]; then set -a; . ./.env; set +a; fi

# One job at a time: a long weekly run and the hourly publish check must not race on git.
exec 9>"${TMPDIR:-/tmp}/xmr-fan-jobs.lock"
flock 9

notify() {
	[ -n "${NOTIFY_URL:-}" ] || return 0
	curl -fsS -m 15 -H "Title: $1" -H "Priority: 4" -H "Tags: rotating_light" \
		${NOTIFY_TOKEN:+-H "Authorization: Bearer $NOTIFY_TOKEN"} -d "$2" "$NOTIFY_URL" >/dev/null || true
}

# What each job runs, which files it may change, its commit message, and whether a change needs a redeploy.
case "$job" in
	weekly)    cmd="gazette:auto -- draft";               paths="src/data/gazette public/news-art"; msg="chore(gazette): draft the weekly issue";  deploy=no ;;
	publish)   cmd="gazette:auto -- publish";             paths="src/data/gazette";                 msg="chore(gazette): publish the weekly issue"; deploy=yes ;;
	donations) cmd="donations:check -- --write --notify"; paths="src/data/donations.json";          msg="chore(donations): record address checks";  deploy=yes ;;
	nodes)     cmd="nodes:check -- --write --notify";     paths="src/data/node-health.json";        msg="chore(nodes): record node health";         deploy=yes ;;
	heights)   cmd="heights";                             paths="src/data/heights.json";            msg="chore(heights): refresh block heights";    deploy=yes ;;
	*) echo "unknown job: $job" >&2; exit 2 ;;
esac

log="$(mktemp)"
trap 'rm -f "$log"' EXIT
fail() { notify "xmr.fan: $job failed" "$1
$(tail -n 25 "$log")"; exit 1; }

git pull --ff-only --quiet >>"$log" 2>&1 || fail "git pull failed"
# Jobs run in the compose `jobs` container (Node and ffmpeg) as this user, so the files they write stay ours.
RUN_UID="${RUN_UID:-$(id -u)}" RUN_GID="${RUN_GID:-$(id -g)}"
export RUN_UID RUN_GID
in_jobs() { docker compose run --rm -T jobs "$@"; }
docker compose --profile jobs build -q jobs >>"$log" 2>&1 || fail "building the jobs image failed"

# Reinstall only when the lockfile changed since the last install.
lock_hash="$(sha256sum package-lock.json | cut -d' ' -f1)"
if [ "$(cat node_modules/.lock-hash 2>/dev/null)" != "$lock_hash" ]; then
	in_jobs npm ci --silent >>"$log" 2>&1 || fail "npm ci failed"
	echo "$lock_hash" >node_modules/.lock-hash
fi

set +e
# shellcheck disable=SC2086
in_jobs npm run --silent $cmd >>"$log" 2>&1
status=$?
set -e
cat "$log"

# Whatever the job wrote is kept even when it then failed: a half-done weekly draft resumes from it, and the
# donation check exits non-zero when an address went missing but has already marked it to be hidden.
# shellcheck disable=SC2086
if [ -n "$(git status --porcelain -- $paths)" ]; then
	# shellcheck disable=SC2086
	git add -- $paths
	git commit --quiet -m "$msg" >>"$log" 2>&1 || fail "git commit failed"
	git push --quiet >>"$log" 2>&1 || fail "git push failed"
	if [ "$deploy" = yes ]; then docker compose up -d --build app >>"$log" 2>&1 || fail "redeploy failed"; fi
fi
[ "$status" = 0 ] || fail "npm run $cmd exited with $status"
