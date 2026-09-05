// Run this once locally to find the team IDs you need for config/teams.json
//
// Usage:
//   FOOTBALL_DATA_API_KEY=your_key_here node scripts/list-teams.js
//
// It prints every team in each of the 5 leagues with its numeric ID.
// Copy the IDs for the 5 clubs you want per league into config/teams.json.

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const CODES = { epl: 'PL', laliga: 'PD', seriea: 'SA', bundesliga: 'BL1', ligue1: 'FL1' };

if (!API_KEY) {
  console.error('Missing FOOTBALL_DATA_API_KEY environment variable.');
  process.exit(1);
}

async function fetchTeams(code) {
  const res = await fetch(`https://api.football-data.org/v4/competitions/${code}/teams`, {
    headers: { 'X-Auth-Token': API_KEY }
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, body };
  }
  return { ok: true, data: await res.json() };
}

async function main() {
  const entries = Object.entries(CODES);
  for (let i = 0; i < entries.length; i++) {
    const [key, code] = entries[i];

    let result = await fetchTeams(code);
    if (!result.ok) {
      // Newly created API keys can take a few minutes to fully activate -
      // wait a bit and retry once before giving up on this league.
      console.log(`First attempt for ${key} (${code}) failed (${result.status}) - retrying in 5s...`);
      await new Promise(r => setTimeout(r, 5000));
      result = await fetchTeams(code);
    }

    if (!result.ok) {
      console.error(`Failed to fetch ${key} (${code}) after retry:`, result.status, result.body);
    } else {
      console.log(`\n=== ${key.toUpperCase()} — ${code} ===`);
      for (const t of result.data.teams) {
        console.log(`${t.id}\t${t.name}`);
      }
    }

    // stay well under the free 10 requests/minute limit, whether this call succeeded or not
    if (i < entries.length - 1) {
      await new Promise(r => setTimeout(r, 6500));
    }
  }
}

main();
