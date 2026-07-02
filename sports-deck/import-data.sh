#!/bin/sh
set -e

# Load environment variables from .env
export $(grep -v '^#' .env | xargs)

# Ensure services are running (db must be up for migrations)
docker compose --profile "*" up -d db

# Wait for Postgres to be ready
echo "Waiting for Postgres to be ready..."
until docker compose --profile "*" exec -T db pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done

echo "Applying Prisma migrations"
docker compose --profile "*" exec -T web npx prisma migrate deploy

if [ -n "${FD_TOKEN:-}" ]; then
  echo "Running fetch scripts"
  docker compose --profile "*" exec -T web npm run fetch:competitions || true
  docker compose --profile "*" exec -T web npm run fetch:teams || true
  docker compose --profile "*" exec -T web npm run fetch:matches || true
  docker compose --profile "*" exec -T web npm run fetch:standings || true

  echo "Seeding after fetch"
  docker compose --profile "*" exec -T web npm run seed:after-fetch || true
else
  echo "FD_TOKEN not set; skipping fetch/seed steps"
fi

echo "Import complete."