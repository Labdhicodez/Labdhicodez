#!/usr/bin/env node
// Generates live profile graphics from the GitHub API. No npm dependencies (Node 20+).
//
//   node scripts/generate-stats.mjs                    live run (needs GH_USER + GITHUB_TOKEN)
//   node scripts/generate-stats.mjs --placeholder      write honest "waiting for data" empty states
//   node scripts/generate-stats.mjs --sample --out /tmp/preview
//                                                      local preview with SYNTHETIC data, watermarked,
//                                                      refuses to write into assets/ or touch README
//
// Outputs (live run): assets/repo-counter.svg, assets/stats-card.svg,
// assets/languages-donut.svg, assets/contributions.svg, data/stats.json,
// and the text summary between the STATS markers in README.md.
// If any API call fails the script exits non-zero and writes NOTHING, so the
// previous graphics stay in place.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { T, DONUT, esc, fmt, rng, text, cardOpen, cardClose } from './theme.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

const PLACEHOLDER = flag('placeholder');
const SAMPLE = flag('sample');
const OUT = path.resolve(opt('out') ?? path.join(ROOT, 'assets'));
const IS_DEFAULT_OUT = OUT === path.join(ROOT, 'assets');
const DAY = 864e5;

if (SAMPLE && IS_DEFAULT_OUT) {
  console.error('--sample writes synthetic data, so it needs --out <folder> other than assets/.');
  process.exit(2);
}

// ------------------------------------------------------------------ data
const API = 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN;

async function gh(url, init = {}) {
  const res = await fetch(url.startsWith('http') ? url : API + url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'profile-stats-generator',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function collect(user) {
  if (!TOKEN) throw new Error('GITHUB_TOKEN is not set (it is provided automatically inside GitHub Actions).');

  const profile = await gh(`/users/${user}`);

  const repos = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await gh(`/users/${user}/repos?type=owner&sort=pushed&per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const own = repos.filter((r) => !r.fork);

  // The profile repository only holds this README and its generator scripts, so
  // counting it would show "JavaScript 100%" and say nothing about real projects.
  const analysed = own.filter((r) => r.name.toLowerCase() !== user.toLowerCase());
  const languages = {};
  for (const r of analysed.slice(0, 100)) {
    const l = await gh(`/repos/${r.full_name}/languages`);
    for (const [k, v] of Object.entries(l)) languages[k] = (languages[k] || 0) + v;
  }

  const to = new Date();
  const from = new Date(to.getTime() - 365 * DAY);
  const query = `query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){
    totalCommitContributions totalPullRequestContributions totalIssueContributions restrictedContributionsCount
    contributionCalendar{totalContributions weeks{contributionDays{date contributionCount weekday}}}}}}`;
  const gql = await gh('https://api.github.com/graphql', {
    method: 'POST',
    body: JSON.stringify({ query, variables: { login: user, from: from.toISOString(), to: to.toISOString() } }),
  });
  if (gql.errors) throw new Error('GraphQL: ' + gql.errors.map((e) => e.message).join('; '));
  const c = gql.data.user.contributionsCollection;

  return {
    pending: false,
    sample: false,
    user,
    publicRepos: profile.public_repos,
    repoPushDates: repos.map((r) => r.pushed_at),
    nonForkRepos: analysed.length,
    stars: own.reduce((s, r) => s + r.stargazers_count, 0),
    forks: own.reduce((s, r) => s + r.forks_count, 0),
    languages: Object.entries(languages).map(([name, bytes]) => ({ name, bytes })).sort((a, b) => b.bytes - a.bytes),
    contrib: {
      total: c.contributionCalendar.totalContributions,
      commits: c.totalCommitContributions,
      prs: c.totalPullRequestContributions,
      issues: c.totalIssueContributions,
      restricted: c.restrictedContributionsCount,
      weeks: c.contributionCalendar.weeks.map((w) => w.contributionDays),
    },
  };
}

// Synthetic data, for previewing the layout only. Always watermarked.
function sampleData() {
  const r = rng(11);
  const today = new Date();
  const start = new Date(today.getTime() - 52 * 7 * DAY);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const weeks = [];
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * DAY);
      if (date > today) continue;
      const active = r() > 0.62;
      days.push({ date: date.toISOString().slice(0, 10), weekday: d, contributionCount: active ? Math.ceil(r() * r() * 9) : 0 });
    }
    weeks.push(days);
  }
  const total = weeks.flat().reduce((s, d) => s + d.contributionCount, 0);
  return {
    pending: false, sample: true, user: 'sample',
    publicRepos: 9,
    repoPushDates: Array.from({ length: 9 }, (_, i) => new Date(Date.now() - i * 23 * DAY).toISOString()),
    nonForkRepos: 8, stars: 14, forks: 3,
    languages: [['C', 46000], ['Python', 31000], ['Jupyter Notebook', 9000], ['HTML', 4000], ['Shell', 1500]].map(([name, bytes]) => ({ name, bytes })),
    contrib: { total, commits: Math.round(total * 0.8), prs: 6, issues: 2, restricted: 0, weeks },
  };
}

// ------------------------------------------------------------------ helpers
const pt = (cx, cy, r, deg) => { const a = (deg * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
const arc = (cx, cy, r, a0, a1) => {
  const [x0, y0] = pt(cx, cy, r, a0); const [x1, y1] = pt(cx, cy, r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
const watermark = (d, w) => d.sample ? text(w - 14, 22, 'SAMPLE DATA – NOT REAL', { size: 10, fill: T.cyan, anchor: 'end', mono: true }) : '';
const val = (d, v) => (d.pending ? '—' : fmt(v));
const monthName = (iso) => new Date(iso + 'T00:00:00Z').toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

// ------------------------------------------------------------------ 1. repository counter ring
function repoCounter(d) {
  const W = 380, H = 300, cx = 190, cy = 140, R = 102, SLOTS = 60, SW = 14;
  const n = d.pending ? 0 : d.publicRepos;
  const lit = Math.min(n, SLOTS);
  const now = Date.now();
  const sweep = 360 / SLOTS, gap = 2.6;
  let dim = '', mid = '', bright = '';
  for (let i = 0; i < SLOTS; i++) {
    const p = `<path d="${arc(cx, cy, R, -90 + i * sweep + gap / 2, -90 + (i + 1) * sweep - gap / 2)}"/>`;
    if (i >= lit) dim += p;
    else if (d.repoPushDates?.[i] && now - Date.parse(d.repoPushDates[i]) <= 90 * DAY) bright += p;
    else mid += p;
  }
  const [sx, sy] = pt(cx, cy, 122, -38);
  const digits = String(n).length;
  const big = d.pending ? '—' : fmt(n);
  const size = digits <= 2 ? 58 : digits === 3 ? 46 : 36;
  const caption = d.pending
    ? 'Waiting for the first automated update'
    : n === 0
      ? 'No public repositories yet – each one will light a segment'
      : n > SLOTS
        ? `Ring shows the ${SLOTS} most recently pushed repositories`
        : '1 segment = 1 public repository · brighter = pushed in last 90 days';
  const desc = d.pending
    ? 'Repository counter waiting for its first update.'
    : `${n} public repositories. Each lit ring segment is one repository; brighter segments were pushed to in the last 90 days.`;
  return cardOpen('rc', W, H, 'Public repository counter', desc) + `
<defs><filter id="rc-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
<radialGradient id="rc-core" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${T.blueDark}" stop-opacity="0.55"/><stop offset="1" stop-color="${T.blueDark}" stop-opacity="0"/></radialGradient></defs>
<circle cx="${cx}" cy="${cy}" r="${R - 8}" fill="url(#rc-core)"/>
<circle cx="${cx}" cy="${cy}" r="${R + 20}" fill="none" stroke="${T.blueMid}" stroke-width="1" stroke-dasharray="2 6" opacity="0.55"/>
<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="2.8" fill="${T.cyan}"/>
<g fill="none" stroke="${T.blueDark}" stroke-width="${SW}" opacity="0.32">${dim}</g>
<g fill="none" stroke="${T.blueMid}" stroke-width="${SW}">${mid}</g>
<g fill="none" stroke="${T.blueLight}" stroke-width="${SW}" opacity="0.6" filter="url(#rc-glow)">${bright}</g>
<g fill="none" stroke="${T.blueLight}" stroke-width="${SW}">${bright}</g>
${text(cx, cy + size * 0.28, big, { size, weight: 700, fill: '#FFFFFF', anchor: 'middle' })}
${text(cx, cy + size * 0.28 + 24, 'public repositories', { size: 12, fill: T.cyan, anchor: 'middle', spacing: 1 })}
${text(cx, 272, caption, { size: 10.5, fill: T.textMuted, anchor: 'middle' })}
${text(cx, 288, 'Source: GitHub REST API', { size: 10.5, fill: T.textMuted, anchor: 'middle', opacity: 0.8 })}
${watermark(d, W)}
` + cardClose;
}

// ------------------------------------------------------------------ 2. statistics card
function statsCard(d) {
  const W = 480, H = 300;
  const c = d.contrib;
  const rows = [
    ['Stars received', 'public repos you own, excluding forks', d.stars],
    ['Forks received', 'public repos you own, excluding forks', d.forks],
    ['Commits', 'last 12 months', c?.commits],
    ['Pull requests', 'opened, last 12 months', c?.prs],
    ['Issues', 'opened, last 12 months', c?.issues],
  ];
  let body = '';
  rows.forEach(([label, sub, v], i) => {
    const y = 60 + i * 38;
    body += `<rect x="22" y="${y + 6}" width="5" height="22" rx="2" fill="${T.blueLight}"/>` +
      text(38, y + 16, label, { size: 14, weight: 600 }) +
      text(38, y + 30, sub, { size: 10.5, fill: T.textMuted }) +
      text(W - 24, y + 27, val(d, v), { size: 24, weight: 700, mono: true, anchor: 'end', fill: '#FFFFFF' }) +
      (i < rows.length - 1 ? `<line x1="22" y1="${y + 37}" x2="${W - 22}" y2="${y + 37}" stroke="${T.blueDark}" stroke-width="1"/>` : '');
  });
  const desc = d.pending
    ? 'Statistics card waiting for its first update.'
    : `Stars ${d.stars}, forks ${d.forks}, commits ${c.commits}, pull requests ${c.prs}, issues ${c.issues} (last 12 months for the last three).`;
  return cardOpen('sc', W, H, 'GitHub statistics', desc) + `
${text(22, 36, 'GitHub statistics', { size: 15, weight: 700 })}
${body}
${text(22, 288, 'Source: GitHub REST + GraphQL APIs, refreshed daily', { size: 10.5, fill: T.textMuted, opacity: 0.85 })}
${watermark(d, W)}
` + cardClose;
}

// ------------------------------------------------------------------ 3. language donut
function languageDonut(d) {
  const W = 380, H = 300, cx = 105, cy = 150, R = 64, SW = 28, C = 2 * Math.PI * R;
  const total = d.pending ? 0 : d.languages.reduce((s, l) => s + l.bytes, 0);
  let ring = '', legend = '';
  let desc;
  if (total === 0) {
    ring = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${T.blueDark}" stroke-width="${SW}" stroke-dasharray="3 6" opacity="0.9"/>`;
    const lines = d.pending
      ? ['Waiting for the first', 'automated update']
      : ['Language analytics will', 'appear as my project', 'portfolio grows.'];
    legend = lines.map((l, i) => text(205, 134 + i * 18, l, { size: i === 0 ? 13 : 12, weight: i === 0 ? 600 : 400, fill: i === 0 ? T.text : T.textMuted })).join('');
    desc = d.pending ? 'Language chart waiting for its first update.' : 'Language analytics will appear as my project portfolio grows.';
  } else {
    const top = d.languages.slice(0, 5);
    const rest = d.languages.slice(5).reduce((s, l) => s + l.bytes, 0);
    const parts = top.map((l, i) => ({ name: l.name, bytes: l.bytes, color: DONUT[i] }));
    if (rest > 0) parts.push({ name: 'Other', bytes: rest, color: T.other });
    let offset = 0;
    parts.forEach((p, i) => {
      const frac = p.bytes / total;
      const len = Math.max(frac * C - (parts.length > 1 ? 2 : 0), 0.5);
      ring += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${p.color}" stroke-width="${SW}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += frac * C;
      const pct = frac * 100;
      const y = 92 + i * 28;
      const name = p.name.length > 14 ? p.name.slice(0, 12) + '…' : p.name;
      legend += `<rect x="205" y="${y - 10}" width="12" height="12" rx="3" fill="${p.color}"/>` +
        text(225, y, name, { size: 13 }) +
        text(W - 20, y, pct < 0.1 ? '<0.1%' : pct.toFixed(1) + '%', { size: 13, mono: true, anchor: 'end', fill: T.pale });
    });
    desc = 'Language share by code size: ' + parts.map((p) => `${p.name} ${(p.bytes / total * 100).toFixed(1)}%`).join(', ') + '.';
  }
  const caption = total === 0 ? 'Excludes this profile repository' : `Share of code bytes in ${d.nonForkRepos} public project ${d.nonForkRepos === 1 ? 'repo' : 'repos'}`;
  return cardOpen('ld', W, H, 'Language distribution', desc) + `
${text(22, 36, 'Languages', { size: 15, weight: 700 })}
${ring}
${text(cx, cy - 2, 'LANGUAGE', { size: 10, fill: T.cyan, anchor: 'middle', spacing: 1.5 })}
${text(cx, cy + 14, 'MIX', { size: 10, fill: T.cyan, anchor: 'middle', spacing: 1.5 })}
${legend}
${text(22, 272, caption, { size: 10.5, fill: T.textMuted })}
${text(22, 288, 'Source: GitHub REST API (languages by bytes)', { size: 10.5, fill: T.textMuted, opacity: 0.85 })}
${watermark(d, W)}
` + cardClose;
}

// ------------------------------------------------------------------ 4. contribution heatmap
function heatmap(d) {
  const W = 480, H = 300, left = 22, top = 76;
  const LEVELS = ['#133C6F', T.blueMid, T.blueLight, T.cyan, T.pale];
  const weeks = d.pending || !d.contrib ? [] : d.contrib.weeks;
  const nWeeks = weeks.length || 53;
  const pitch = (W - left * 2) / nWeeks, cell = pitch - 1.6;
  const all = weeks.flat();
  const max = Math.max(0, ...all.map((x) => x.contributionCount));
  const level = (n) => (n <= 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));

  let cells = '', months = '';
  let lastMonthX = -99, lastMonth = '';
  for (let w = 0; w < nWeeks; w++) {
    const days = weeks[w] || [];
    for (let k = 0; k < 7; k++) {
      const day = days.find((x) => x.weekday === k);
      if (weeks.length && !day) continue;
      const n = day ? day.contributionCount : 0;
      const op = n === 0 ? 0.55 : 1;
      cells += `<rect x="${(left + w * pitch).toFixed(1)}" y="${(top + k * pitch).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" rx="1.6" fill="${LEVELS[level(n)]}" opacity="${op}"/>`;
    }
    if (days[0]) {
      const m = monthName(days[0].date);
      const x = left + w * pitch;
      if (m !== lastMonth && x - lastMonthX > 26) { months += text(x.toFixed(1), top - 8, m, { size: 10, fill: T.textMuted }); lastMonthX = x; }
      lastMonth = m;
    }
  }

  // summary numbers (real values only)
  const total = d.pending ? null : d.contrib.total;
  const active = all.filter((x) => x.contributionCount > 0).length;
  const byMonth = {};
  all.forEach((x) => { const k = x.date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + x.contributionCount; });
  const best = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0];
  const busiest = !d.pending && best && best[1] > 0 ? `${monthName(best[0] + '-01')} (${fmt(best[1])})` : '—';

  const gridBottom = top + 7 * pitch;
  const stat = (x, label, value) => text(x, 224, value, { size: 24, weight: 700, mono: true, fill: '#FFFFFF' }) + text(x, 242, label, { size: 10.5, fill: T.textMuted });
  const legendX = W - 22 - 5 * 13 - 62;
  let legend = text(legendX + 22, gridBottom + 18, 'Less', { size: 10, fill: T.textMuted, anchor: 'end' });
  for (let i = 0; i < 5; i++) legend += `<rect x="${legendX + 30 + i * 13}" y="${gridBottom + 9}" width="10" height="10" rx="2" fill="${LEVELS[i]}"/>`;
  legend += text(legendX + 30 + 5 * 13 + 4, gridBottom + 18, 'More', { size: 10, fill: T.textMuted });

  const note = d.pending ? 'Waiting for the first automated update' : total === 0 ? 'No contributions recorded yet – squares fill in as you commit.' : '';
  const desc = d.pending
    ? 'Contribution heatmap waiting for its first update.'
    : `${total} contributions in the last 12 months across ${active} active days. Busiest month: ${busiest}.`;
  return cardOpen('ch', W, H, 'Contributions in the last 12 months', desc) + `
${text(22, 36, 'Contributions, last 12 months', { size: 15, weight: 700 })}
${months}
${cells}
${legend}
${note ? text(22, gridBottom + 18, note, { size: 11, fill: T.cyan }) : ''}
<line x1="22" y1="184" x2="458" y2="184" stroke="${T.blueDark}"/>
${stat(22, 'contributions', d.pending ? '—' : fmt(total))}
${stat(180, 'active days', d.pending ? '—' : fmt(active))}
${stat(308, 'busiest month', busiest === '—' ? '—' : busiest.split(' ')[0])}
${text(22, 272, 'Counts commits, pull requests, issues and reviews as GitHub counts them.', { size: 10.5, fill: T.textMuted })}
${text(22, 288, 'Source: GitHub GraphQL API (contributionCalendar)', { size: 10.5, fill: T.textMuted, opacity: 0.85 })}
${watermark(d, W)}
` + cardClose;
}

// ------------------------------------------------------------------ summary text for README
function summaryLine(d) {
  const langs = d.languages.length
    ? ' · Languages: ' + (() => {
        const t = d.languages.reduce((s, l) => s + l.bytes, 0);
        return d.languages.slice(0, 3).map((l) => `${l.name} ${(l.bytes / t * 100).toFixed(0)}%`).join(', ');
      })()
    : '';
  return `**Live snapshot:** ${fmt(d.publicRepos)} public ${d.publicRepos === 1 ? 'repository' : 'repositories'} · ${fmt(d.stars)} ${d.stars === 1 ? 'star' : 'stars'} received · ${fmt(d.contrib.total)} contributions in the last 12 months${langs}. Refreshed daily by GitHub Actions.`;
}
const PENDING_LINE = '**Live snapshot:** will appear after the first automated update (Actions → Update profile stats → Run workflow).';

// ------------------------------------------------------------------ main
async function main() {
  let data;
  if (PLACEHOLDER) data = { pending: true, languages: [], repoPushDates: [], contrib: null };
  else if (SAMPLE) data = sampleData();
  else {
    const user = process.env.GH_USER;
    if (!user) throw new Error('GH_USER is not set (inside Actions use github.repository_owner).');
    data = await collect(user);
  }

  const files = {
    'repo-counter.svg': repoCounter(data),
    'stats-card.svg': statsCard(data),
    'languages-donut.svg': languageDonut(data),
    'contributions.svg': heatmap(data),
  };

  await mkdir(OUT, { recursive: true });
  for (const [name, svg] of Object.entries(files)) await writeFile(path.join(OUT, name), svg);

  if (!SAMPLE && IS_DEFAULT_OUT) {
    if (!PLACEHOLDER) {
      const snapshot = {
        publicRepos: data.publicRepos, stars: data.stars, forks: data.forks,
        nonForkRepos: data.nonForkRepos, languages: data.languages,
        contributionsLast12Months: { total: data.contrib.total, commits: data.contrib.commits, pullRequests: data.contrib.prs, issues: data.contrib.issues },
      };
      await mkdir(path.join(ROOT, 'data'), { recursive: true });
      await writeFile(path.join(ROOT, 'data/stats.json'), JSON.stringify(snapshot, null, 2) + '\n');
    }
    const readmePath = path.join(ROOT, 'README.md');
    try {
      const md = await readFile(readmePath, 'utf8');
      const re = /(<!--STATS:START-->)[\s\S]*?(<!--STATS:END-->)/;
      if (re.test(md)) await writeFile(readmePath, md.replace(re, `$1\n${PLACEHOLDER ? PENDING_LINE : summaryLine(data)}\n$2`));
    } catch { /* README not present: skip */ }
  }
  console.log(`Wrote ${Object.keys(files).length} SVGs to ${OUT}${SAMPLE ? ' (SAMPLE DATA)' : ''}`);
}

main().catch((e) => { console.error('Stats update failed, nothing was written:', e.message); process.exit(1); });
