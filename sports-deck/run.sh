#!/usr/bin/env bash
# fail on unset vars and errors
set -eu
# enable pipefail when running in bash / when supported
if [ -n "${BASH_VERSION-}" ]; then
    set -o pipefail 2>/dev/null || true
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
    echo "node_modules not found. Run startup.sh first"
    exit 1
fi

load_env_file() {
    env_file="$1"
    tmp_env="$(mktemp 2>/dev/null || printf "%s/runenv.%s" "${TMPDIR:-/tmp}" "$$")"
    tr -d '\r' < "$env_file" > "$tmp_env"
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            ''|\#*) continue ;;
        esac
        export "$line"
    done < "$tmp_env"
    rm -f "$tmp_env"
}

if [ -f ".env.local" ]; then
    load_env_file ".env.local"
elif [ -f ".env" ]; then
    load_env_file ".env"
fi

if [ -z "${FD_TOKEN:-}" ]; then
    echo "FD_TOKEN is required for fetch scripts. Set it in .env/.env.local or environment."
    exit 1
fi

echo "[run] Running fetch scripts..."
npm run fetch:competitions
npm run fetch:teams
npm run fetch:matches
npm run fetch:standings

echo "[run] Starting server and worker..."
npm run dev &
DEV_PID=$!

npm run start-worker &
WORKER_PID=$!

cleanup() {
    echo "[run] Stopping processes..."
    kill "$DEV_PID" "$WORKER_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

# wait until one of the background processes exits
while kill -0 "$DEV_PID" 2>/dev/null && kill -0 "$WORKER_PID" 2>/dev/null; do
    sleep 1
done

echo "[run] One process exited. Shutting down the other..."
cleanup
wait "$DEV_PID" "$WORKER_PID" 2>/dev/null || true
