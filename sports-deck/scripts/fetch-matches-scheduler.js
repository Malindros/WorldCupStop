#!/usr/bin/env node
/*
 * This scheduler script was written with the help of ChatGPT. It runs the
 * fetch scripts on a schedule (using `node-cron`) and manages simple logging
 * and state for the SportsDeck project.
 *
 * Usage context: Requires `FOOTBALL_API_KEY` and will run other scripts that
 * modify the local database (Teams, Matches, Seasons, TeamStandings). Start
 * it only when you intend to perform those updates.
 */
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { run } = require('./fetch-matches');
const { run: runCompetitions } = require('./fetch-competitions');
const { run: runTeams } = require('./fetch-teams');
const { run: runStandings } = require('./fetch-standings');

const SCHEDULE = process.env.CRON_SCHEDULE || '0 */2 * * *'; // every 2 hours by default
const LOG_DIR = path.resolve(__dirname, '..', 'logs');
const STATE_DIR = path.resolve(__dirname, '..', '.data');
const STATE_FILE = path.join(STATE_DIR, 'worker-state.json');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function logfileForDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return path.join(LOG_DIR, `fetch-matches-${y}-${m}-${day}.log`);
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  ensureLogDir();
  const file = logfileForDate();
  try {
    fs.appendFileSync(file, line);
  } catch (e) {
    // fallback to console if writing fails
    console.error('Failed to write log file', e.message);
  }
  console.log(line.trim());
}

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
}

function readState() {
  try {
    ensureStateDir();
    if (!fs.existsSync(STATE_FILE)) return {};
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to read state', err.message);
    return {};
  }
}

function writeState(state) {
  try {
    ensureStateDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn('Failed to write state', err.message);
  }
}

const CONSECUTIVE_FAILURES_ALERT = Number(process.env.CONSECUTIVE_FAILURES_ALERT) || 3;
const STALE_DATA_HOURS = Number(process.env.STALE_DATA_HOURS) || 48;
const MIN_MATCHES_PER_RUN = Number(process.env.MIN_MATCHES_PER_RUN) || 1;

async function sendWebhook(message) {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    // use global fetch (Node 18+). If unavailable this will throw.
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.error('Failed to send webhook:', err.message);
  }
}

log(`Scheduler starting, schedule=${SCHEDULE}`);

// run once at startup
(async () => {
  try {
    log('Initial run starting');
    // record start
    const state = readState();
    state.lastRun = new Date().toISOString();
    writeState(state);

    // ensure token present for child scripts
    if (!process.env.FD_TOKEN) {
      log('FD_TOKEN not set in environment. Aborting initial run.');
      await sendWebhook('FD_TOKEN not set; worker aborted initial run');
      return;
    }

    const res = await run();
    log('Initial run finished');
    // update state on success
    state.lastSuccess = new Date().toISOString();
    state.consecutiveFailures = 0;
    state.lastError = null;
    state.lastFetchCount = res && typeof res.count === 'number' ? res.count : 0;
    writeState(state);

    if (state.lastFetchCount < MIN_MATCHES_PER_RUN) {
      await sendWebhook(`Warning: low fetch count: ${state.lastFetchCount}`);
    }

    // run post-sync scripts: competitions always, teams/standings only if SEASON is provided
    try {
      const compRes = await runCompetitions();
      state.lastCompetitionsFetchCount = compRes && typeof compRes.count === 'number' ? compRes.count : 0;
      writeState(state);
    } catch (err) {
      log('Competitions fetch error: ' + err.message);
      await sendWebhook(`Competitions fetch error: ${err.message}`);
    }

    if (process.env.SEASON) {
      try {
        const teamsRes = await runTeams();
        state.lastTeamsFetchCount = teamsRes && typeof teamsRes.count === 'number' ? teamsRes.count : 0;
        writeState(state);
      } catch (err) {
        log('Teams fetch error: ' + err.message);
        await sendWebhook(`Teams fetch error: ${err.message}`);
      }

      try {
        const stRes = await runStandings();
        state.lastStandingsInsertCount = stRes && typeof stRes.inserted === 'number' ? stRes.inserted : 0;
        writeState(state);
      } catch (err) {
        log('Standings fetch error: ' + err.message);
        await sendWebhook(`Standings fetch error: ${err.message}`);
      }
    }
  } catch (err) {
    log('Initial run error: ' + err.message);
    const state = readState();
    state.lastError = err.message;
    state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
    writeState(state);
    await sendWebhook(`Initial fetch error: ${err.message}`);
    if (state.consecutiveFailures >= CONSECUTIVE_FAILURES_ALERT) {
      await sendWebhook(`Alert: worker failing ${state.consecutiveFailures} times`);
    }
  }
})();

cron.schedule(SCHEDULE, async () => {
  try {
    log('Scheduled run starting');
    const state = readState();
    state.lastRun = new Date().toISOString();
    writeState(state);

    const res = await run();
    log('Scheduled run finished');
    state.lastSuccess = new Date().toISOString();
    state.consecutiveFailures = 0;
    state.lastError = null;
    state.lastFetchCount = res && typeof res.count === 'number' ? res.count : 0;
    writeState(state);

    if (state.lastFetchCount < MIN_MATCHES_PER_RUN) {
      await sendWebhook(`Warning: low fetch count: ${state.lastFetchCount}`);
    }

    // run post-sync scripts
    try {
      const compRes = await runCompetitions();
      state.lastCompetitionsFetchCount = compRes && typeof compRes.count === 'number' ? compRes.count : 0;
      writeState(state);
    } catch (err) {
      log('Competitions fetch error: ' + err.message);
      await sendWebhook(`Competitions fetch error: ${err.message}`);
    }

    if (process.env.SEASON) {
      try {
        const teamsRes = await runTeams();
        state.lastTeamsFetchCount = teamsRes && typeof teamsRes.count === 'number' ? teamsRes.count : 0;
        writeState(state);
      } catch (err) {
        log('Teams fetch error: ' + err.message);
        await sendWebhook(`Teams fetch error: ${err.message}`);
      }

      try {
        const stRes = await runStandings();
        state.lastStandingsInsertCount = stRes && typeof stRes.inserted === 'number' ? stRes.inserted : 0;
        writeState(state);
      } catch (err) {
        log('Standings fetch error: ' + err.message);
        await sendWebhook(`Standings fetch error: ${err.message}`);
      }
    }
  } catch (err) {
    log('Scheduled run error: ' + err.message);
    const state = readState();
    state.lastError = err.message;
    state.consecutiveFailures = (state.consecutiveFailures || 0) + 1;
    writeState(state);
    await sendWebhook(`Scheduled fetch error: ${err.message}`);
    if (state.consecutiveFailures >= CONSECUTIVE_FAILURES_ALERT) {
      await sendWebhook(`Alert: worker failing ${state.consecutiveFailures} times`);
    }
  }
});
