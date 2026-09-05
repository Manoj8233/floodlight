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

async function main() {
  for (const [key, code] of Object.entries(CODES)) {
    const res = await fetch(`https://api.football-data.org/v4/competitions/${code}/teams`, {
      headers: { 'X-Auth-Token': API_KEY }
    });
    if (!res.ok) {
      console.error(`Failed to fetch ${key} (${code}):`, res.status, await res.text());
      continue;
    }
    const data = await res.json();
    console.log(`\n=== ${key.toUpperCase()} — ${code} ===`);
    for (const t of data.teams) {
      console.log(`${t.id}\t${t.name}`);
    }
    // stay well under the free 10 requests/minute limit
    await new Promise(r => setTimeout(r, 6500));
  }
}

main();
