#!/bin/sh
# Holds an automatic issue during its review window, or releases it (runs in the jobs container).
#   ops/hold.sh 2026-10-12 [--release]
set -eu
cd "$(dirname "$0")/.."
RUN_UID="$(id -u)" RUN_GID="$(id -g)"
export RUN_UID RUN_GID
docker compose run --rm -T jobs npm run --silent gazette:hold -- "$@"
