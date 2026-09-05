// Runs on a schedule via GitHub Actions (see .github/workflows/check-matches.yml).
// Reads config/teams.json, checks football-data.org for your tracked teams' matches,
// sends push notifications via OneSignal, and writes data/matches.json + data/state.json
// so the frontend (index.html) can show current matches too.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAMS_PATH = path.join(__dirname, '..', 'config', 'teams.json');
const STATE_PATH = path.join(__dirname, '..', 'data', 'state.json');
const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'matches.json');

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const LEAD_MINUTES = Number(process.env.LEAD_MINUTES || 15);

if (!API_KEY || !ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.error('Missing one or more required environment variables (FOOTBALL_DATA_API_KEY, ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY).');
  process.exit(1);
}

function loadJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

const teamsConfig = loadJSON(TEAMS_PATH, {});
let state = loadJSON(STATE_PATH, { notified: {}, scores: {} });

function leagueEntries() {
  return Object.entries(teamsConfig).filter(([k, v]) => v && Array.isArray(v.teams));
}

function trackedTeamIds() {
  const ids = new Set();
  for (const [, league] of leagueEntries()) {
    for (const t of league.teams) ids.add(t.id);
  }
  return ids;
}

async function fetchCompetitionMatches(code) {
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = `https://api.football-data.org/v4/competitions/${code}/matches?dateFrom=${from}&dateTo=${to}`;

  let res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
  if (!res.ok) {
    // Transient errors happen occasionally - wait a moment and retry once before giving up.
    console.log(`First attempt for ${code} failed (${res.status}) - retrying in 5s...`);
    await new Promise(r => setTimeout(r, 5000));
    res = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } });
  }

  if (!res.ok) {
    console.error(`Failed to fetch ${code}:`, res.status, await res.text());
    return [];
  }
  const data = await res.json();
  return data.matches || [];
}

async function sendPush(title, body, url) {
  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      included_segments: ['Subscribed Users'],
      headings: { en: title },
      contents: { en: body },
      ...(url ? { url } : {})
    })
  });
    const resultText = await res.text();
  if (!res.ok) {
    console.error('OneSignal error:', res.status, resultText);
  } else {
    console.log('Sent push:', title, '-', body, '| Response:', resultText);
  }
}

async function main() {
  const trackedIds = trackedTeamIds();
  if (trackedIds.size === 0) {
    console.log('config/teams.json has no teams yet - run scripts/list-teams.js and fill it in. Nothing to do.');
    return;
  }

  const codes = [...new Set(leagueEntries().map(([, l]) => l.competitionCode))];

  let allMatches = [];
  for (const code of codes) {
    const matches = await fetchCompetitionMatches(code);
    allMatches.push(...matches.map(m => ({ ...m, _leagueCode: code })));
    await new Promise(r => setTimeout(r, 6500)); // stay under free 10 req/min limit
  }

  const relevant = allMatches.filter(m =>
    trackedIds.has(m.homeTeam.id) || trackedIds.has(m.awayTeam.id)
  );

  const now = Date.now();

  for (const m of relevant) {
    const matchId = String(m.id);
    const kickoff = new Date(m.utcDate).getTime();
    const minsToKickoff = (kickoff - now) / 60000;
    const label = `${m.homeTeam.shortName || m.homeTeam.name} vs ${m.awayTeam.shortName || m.awayTeam.name}`;
    const scoreNow = `${m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0}-${m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0}`;

    const soonKey = `soon-${matchId}`;
    if ((m.status === 'SCHEDULED' || m.status === 'TIMED') && minsToKickoff > 0 && minsToKickoff <= LEAD_MINUTES && !state.notified[soonKey]) {
      await sendPush('Kickoff soon', `${label} starts in about ${Math.round(minsToKickoff)} min.`);
      state.notified[soonKey] = true;
    }

    const liveKey = `live-${matchId}`;
    if ((m.status === 'IN_PLAY' || m.status === 'PAUSED') && !state.notified[liveKey]) {
      await sendPush('Kickoff!', `${label} is underway now.`);
      state.notified[liveKey] = true;
    }

    const prevScore = state.scores[matchId];
    if ((m.status === 'IN_PLAY' || m.status === 'PAUSED') && prevScore && prevScore !== scoreNow) {
      await sendPush('Goal!', `${label} — now ${scoreNow}.`);
    }
    if (['IN_PLAY', 'PAUSED', 'FINISHED'].includes(m.status)) {
      state.scores[matchId] = scoreNow;
    }

    const ftKey = `ft-${matchId}`;
    if (m.status === 'FINISHED' && !state.notified[ftKey]) {
      const hlUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(label + ' highlights')}`;
      await sendPush('Full time', `${label} finished ${scoreNow}.`, hlUrl);
      state.notified[ftKey] = true;
    }
  }

  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));

  const snapshot = relevant
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
    .map(m => ({
      id: m.id,
      league: m._leagueCode,
      home: m.homeTeam.shortName || m.homeTeam.name,
      away: m.awayTeam.shortName || m.awayTeam.name,
      status: m.status,
      utcDate: m.utcDate,
      score: state.scores[String(m.id)] || null
    }));
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));

  console.log(`Checked ${relevant.length} tracked match(es) across ${codes.length} league(s).`);
}

main().catch(e => { console.error(e); process.exit(1); });
