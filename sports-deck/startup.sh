#!/usr/bin/env bash
set -euo pipefail

# Run from repository root no matter where script is invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -f ".env.local" ]]; then
  set -a
  source <(tr -d '\r' < ".env.local")
  set +a
elif [[ -f ".env" ]]; then
  set -a
  source <(tr -d '\r' < ".env")
  set +a
fi

echo "Installing npm dependencies..."
npm install

echo "Generating Prisma client..."
npx prisma generate

echo "Running Prisma migrate dev..."
MIGRATION_NAME="${MIGRATION_NAME:-startup_sync}"
npx prisma migrate dev --name "$MIGRATION_NAME"

if [[ -z "${FD_TOKEN:-}" ]]; then
  echo "FD_TOKEN is required for fetch scripts."
  echo "Example: FD_TOKEN=your_token ./startup.sh"
  exit 1
fi

echo "Fetching competitions..."
npm run fetch:competitions

echo "Fetching teams..."
npm run fetch:teams

echo "Fetching matches..."
npm run fetch:matches

echo "Fetching standings..."
npm run fetch:standings

echo "Seeding social data..."
npm run seed:after-fetch

echo "Startup completed successfully."
