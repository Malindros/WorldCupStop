#!/bin/sh
set -e
# Build and start all services in detached mode
docker compose --profile local up -d --build
