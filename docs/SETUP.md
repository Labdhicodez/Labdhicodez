# Setup guide

A GitHub profile README lives in a repository named exactly like your username. Everything here is plain Markdown/HTML, SVG, one dependency-free Node script and one workflow. No paid service, no personal access token.

## 1. File layout

```
YOUR_USERNAME/                      <- repository must be named after your username, set to Public
├── README.md                       profile page
├── assets/
│   ├── banner.svg                  static hero banner
│   ├── about-cosmos.svg            static observatory illustration
│   ├── repo-counter.svg            generated: ring counter
│   ├── stats-card.svg              generated: stars, forks, commits, PRs, issues
│   ├── languages-donut.svg         generated: language share
│   └── contributions.svg           generated: 12-month heatmap
├── data/stats.json                 generated: plain-data snapshot
├── scripts/
│   ├── theme.mjs                   palette + shared SVG helpers
│   ├── build-art.mjs               makes banner.svg and about-cosmos.svg
│   └── generate-stats.mjs          live data -> SVGs, JSON, README text line
├── docs/SETUP.md                   this file
└── .github/workflows/update-stats.yml
```

## 2. First-time setup

1. Create a **public** repository named `YOUR_USERNAME` (same spelling as your account) and push these files to the `main` branch.
2. In `README.md`, search for `YOUR` and replace: name, username, LinkedIn URL, email, and the project link (or delete the project row).
3. Put your name in the banner and rebuild it (needs Node 20+):
   ```
   node scripts/build-art.mjs --name "Your Name"
   ```
4. Repository **Settings → Actions → General → Workflow permissions**: choose **Read and write permissions**. The workflow declares `contents: write` itself, but the repository setting must not block it.
5. **Actions → Update profile stats → Run workflow.** After about 30 seconds the four generated graphics, `data/stats.json` and the "Live snapshot" line in the README are replaced with real data.
6. Open `https://github.com/YOUR_USERNAME` and check it.

Until step 5 the graphics show honest empty states ("Waiting for the first automated update"), never made-up numbers.

## 3. Services used

| Service | Used for | Required? |
|---|---|---|
| GitHub REST + GraphQL API (via the built-in `GITHUB_TOKEN`) | all live numbers | yes, free |
| GitHub Actions | daily refresh | yes, free for public repos |
| shields.io | small static text badges (connect links, tech stack) | cosmetic only; alt text remains if it is down |

Third-party stats widgets, trophy generators and streak cards are deliberately **not** used: they can't be fully recoloured to the palette, they rate-limit, and they go offline. All four analytics graphics are generated into your own repository.

## 4. What each metric means

| Value | Source | Period | Limitations |
|---|---|---|---|
| Public repositories | `GET /users/{user}` → `public_repos` | now | includes forks; ring shows up to 60 segments |
| Stars / forks received | `GET /users/{user}/repos`, summed | now | public non-fork repos only; includes your own stars |
| Commits, pull requests, issues | GraphQL `contributionsCollection` | last 365 days | commits are those GitHub attributes to you on default branches; private work counts only if you enable "Private contributions" in profile settings |
| Contributions and heatmap | GraphQL `contributionCalendar` | last 365 days | GitHub's definition: commits, PRs, issues, reviews |
| Language share | `GET /repos/{repo}/languages`, summed | now | bytes of code, not skill; first 100 non-fork repos; vendored or generated files can skew it |

Stars and forks are shown once, in the stats card. The ring shows repositories only, and the heatmap shows contributions only, so no metric repeats.

## 5. Testing

- **Preview the layout without data** (synthetic numbers, watermarked "SAMPLE DATA", refuses to write into `assets/` or touch the README):
  ```
  node scripts/generate-stats.mjs --sample --out /tmp/preview
  ```
  Open the SVGs in a browser.
- **Reset to empty states:** `node scripts/generate-stats.mjs --placeholder`
- **Live test locally:** create a fine-grained or classic token with no extra scopes, then
  ```
  GH_USER=YOUR_USERNAME GITHUB_TOKEN=<token> node scripts/generate-stats.mjs
  ```
  Never commit the token or paste it into a file.
- **Verify the counter is truthful:** compare the ring number with the "Repositories" count on your profile (public only), and `data/stats.json` with the cards.
- **Verify the schedule:** Actions tab → the "Update profile stats" run list shows a daily entry once the cron has fired. GitHub may delay scheduled runs by several minutes, and disables schedules on repositories with no activity for 60 days; re-enable under Actions if that happens.

## 6. Fallback plan

| Failure | What happens |
|---|---|
| GitHub API error or rate limit | the script exits without writing anything; previous graphics stay; the run shows red in Actions |
| New or empty account | real zeros are displayed; the donut shows "No language data yet"; the heatmap shows an empty grid with a note |
| Graphic doesn't load | each image has descriptive `alt` text, and the "Live snapshot" text line under the dashboard carries the key numbers |
| shields.io outage | alt text shows the label, e.g. "C: learning" |
| Workflow disabled | graphics stop updating but keep showing the last good values; re-enable under Actions |

The workflow commits only when output changed, using the `github-actions[bot]` identity. Those commits are not attributed to you and do not add to your contribution graph, so the dashboard can't inflate itself.

## 7. Changing the theme safely

- Colours live only in `scripts/theme.mjs`. Edit them, then run `node scripts/build-art.mjs` and push (the workflow regenerates the stats graphics when `scripts/**` changes, or run it manually).
- Keep each SVG's `width`/`height`/`viewBox` unchanged. The README table cells (44% / 56%) match the card aspect ratios, so rows stay level.
- GitHub strips CSS and JavaScript from READMEs. Styling belongs inside the SVG files, never in Markdown.
- Chart colours always come with text labels and numbers, so meaning never depends on colour alone.

## 8. Known limits

- GitHub's README renderer doesn't reflow tables on phones. Table cells therefore scale as a unit (images are `width="100%"` of their cell) instead of stacking; the code panel is deliberately outside the table so it keeps full width.
- The sidebar and page chrome can't be themed from a README. The navy identity lives in the banner, illustration and cards.
- Trophies and achievement badges are omitted: none exist yet to display truthfully. Add them only when they reflect real achievements.
- SVGs use system fonts (web fonts can't load inside `<img>`), so typography varies slightly by device.
