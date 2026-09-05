# Floodlight

A free, real, always-on notification app for your top-5 clubs across the Premier League,
La Liga, Serie A, Bundesliga, and Ligue 1. Push alerts for kickoff, goals, and full time,
plus a home-screen app you can install on your phone.

**How it stays "always on" without a server you manage:**
A GitHub Action runs on GitHub's servers every 10 minutes, checks match data, and sends
push notifications straight to your phone — even if the app isn't open, your laptop is off,
and this chat is long gone. The webpage itself is just a static site hosted for free on
GitHub Pages.

**What's genuinely free here:** GitHub (public repo + Actions), GitHub Pages hosting,
football-data.org's free API tier, and OneSignal's free push tier. No credit card needed
for any of it.

**Known limits of the free tier (worth knowing up front):**
- football-data.org's free plan gives slightly delayed scores and 10 requests/minute —
  so goal alerts may land a few minutes after the real thing, not instantly.
- iOS web push (for the home-screen app) requires iOS 16.4 or later, and only works once
  you've added the site to your home screen — not from a regular Safari tab.
- The 5 clubs per league are whatever you set in `config/teams.json` — this doesn't
  auto-detect "current top 5," you (or a future upgrade) update it as standings change.

---

## Setup steps

### 1. Create three free accounts
- **GitHub** — if you don't already have one: https://github.com/signup
- **football-data.org** — free API key, instant, no card: https://www.football-data.org/client/register
- **OneSignal** — free push notifications: https://onesignal.com/ → sign up → **New App/Website** → choose **Web Push**

### 2. Create your OneSignal app
- Platform: **Web Push**
- Site name: `Floodlight`
- Site URL: `https://YOUR_GITHUB_USERNAME.github.io/floodlight-app/` (use this now even
  though the site isn't live yet — you'll deploy it in step 4)
- Once created, go to **Settings → Keys & IDs** and copy:
  - **OneSignal App ID**
  - **REST API Key**

### 3. Put this project on GitHub
- Create a new **public** repository named `floodlight-app`
- Upload every file in this folder to it (drag-and-drop on github.com works, or use git)

### 4. Turn on GitHub Pages
- In your repo: **Settings → Pages**
- Source: **Deploy from a branch** → Branch: `main`, folder: `/ (root)`
- Save. After a minute or two your site is live at
  `https://YOUR_GITHUB_USERNAME.github.io/floodlight-app/`

### 5. Add your OneSignal App ID to the site
- Edit `index.html` in the repo, find the line:
  ```
  appId: "YOUR_ONESIGNAL_APP_ID",
  ```
  and replace it with the real App ID from step 2. Commit the change.

### 6. Add your secret keys to GitHub Actions
- In your repo: **Settings → Secrets and variables → Actions → New repository secret**
- Add all three:
  - `FOOTBALL_DATA_API_KEY`
  - `ONESIGNAL_APP_ID`
  - `ONESIGNAL_REST_API_KEY`

### 7. Pick your 5 teams per league
- On your own computer (needs Node.js installed), run:
  ```
  FOOTBALL_DATA_API_KEY=your_key_here node scripts/list-teams.js
  ```
- This prints every team in each league with its numeric ID. Find your 5 picks per league.
- Edit `config/teams.json` and fill in the `teams` arrays, e.g.:
  ```json
  "epl": {
    "competitionCode": "PL",
    "teams": [
      { "id": 65, "name": "Manchester City" },
      { "id": 57, "name": "Arsenal" }
    ]
  }
  ```
- Commit and push the updated file.

### 8. Run it once manually to test
- In your repo: **Actions tab → "Check Matches" → Run workflow**
- Check the run logs. If it worked, `data/matches.json` and `data/state.json` will update
  in your repo automatically.

### 9. Install it on your phone
- Open `https://YOUR_GITHUB_USERNAME.github.io/floodlight-app/` on your phone
- **iPhone:** Share button → **Add to Home Screen**
- **Android:** Chrome menu (⋮) → **Install app**
- Open it from the home screen icon (not the browser tab), then tap **"Turn on kickoff
  alerts"** and allow notifications

That's it — the GitHub Action now checks your tracked teams every 10 minutes, forever,
for free, and pushes straight to your phone.

### Adjusting things later
- Change how early you're notified before kickoff: edit `LEAD_MINUTES` in
  `.github/workflows/check-matches.yml` (add it under `env:`) — defaults to 15 minutes.
- Change your tracked teams any time: edit `config/teams.json` and push.
- "Highlights" open a YouTube search for the match rather than an embedded clip — free
  APIs don't license official broadcast highlight footage, so this is the honest free option.
