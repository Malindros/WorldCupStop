#!/bin/sh
set -e
# Stop and remove containers, networks, volumes created by compose
docker compose --profile local down
