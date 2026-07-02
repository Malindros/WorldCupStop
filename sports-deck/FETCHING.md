# Data Fetching Scripts

<!--
	This document and the associated fetch scripts were created with the
	help of ChatGPT to provide a lightweight data ingestion pipeline for the
	SportsDeck project.

	Usage context: These scripts may modify the local database (Team, Match,
	Season, TeamStanding) via Prisma upserts. They require a valid
	`FOOTBALL_API_KEY` to contact the external provider. Run them with care and
	backup your local DB if needed.
-->

This document explains the included data-fetch scripts, env vars, and recommended order.

Environment variables
- `FD_TOKEN` (required): API token for football-data.org or equivalent provider.
- `COMPETITION` (optional): competition code, e.g. `PL`, `BL1`, `DED`. Defaults to `PL`.
- `SEASON` (optional): season year/id to fetch specific season data for teams/standings.
- `FORCE` (optional): set to `1`/`true` to force `fetch-matches` even if a season was updated in the last hour.
- `CRON_SCHEDULE` (optional): cron expression for the worker; default hourly: `0 * * * *`.
- `REQUESTS_PER_MIN` (optional): default `10`.
- `MAX_RETRIES` (optional): default `5`.
- `MIN_MATCHES_PER_RUN` (optional): default `1`.
- `ERROR_WEBHOOK_URL` (optional): POST endpoint to receive failure alerts.

Scripts
- `node scripts/fetch-competitions.js` — fetch competition details and upsert `Season` rows.
- `node scripts/fetch-teams.js` — fetch teams for the competition (and optional `SEASON`) and upsert `Team` rows.
- `node scripts/fetch-standings.js` — fetch standings for competition + `SEASON` and upsert `TeamStanding` rows.
- `node scripts/fetch-matches.js` — fetch matches across all known local seasons (using each season's start year for `?season=`), skipping seasons updated within the last hour unless `FORCE` is set.
- `node scripts/fetch-matches-scheduler.js` — scheduler: runs `fetch-matches` then `fetch-competitions`; if `SEASON` is set it also runs `fetch-teams` and `fetch-standings`.

NPM shortcuts
- `npm run fetch:competitions`
- `npm run fetch:teams`
- `npm run fetch:standings`
- `npm run start-worker` — start the scheduled worker (requires `FOOTBALL_API_KEY`)

Recommended run order
1. `fetch-competitions` (upserts seasons)
2. `fetch-teams` (populate teams for a season)
3. `fetch-matches` (populate matches)
4. `fetch-standings` (compute and store standings snapshot)

Examples

Run a single fetch of teams for Premier League 2021:

```bash
FD_TOKEN=xxx COMPETITION=PL SEASON=2021 node scripts/fetch-teams.js
```

Start scheduled worker (hourly by default):

```bash
FD_TOKEN=xxx COMPETITION=PL SEASON=2021 ERROR_WEBHOOK_URL=https://hooks.example npm run start-worker
```

Notes
- The scripts upsert by `externalId` fields on `Match`, `Team`, and `Season` so running them repeatedly is idempotent.
- `fetch-matches` skips restricted seasons (`403`) and continues with other seasons instead of failing the whole run.
- For a school project this setup is intentionally lightweight and uses no additional libraries for logging/alerts.
