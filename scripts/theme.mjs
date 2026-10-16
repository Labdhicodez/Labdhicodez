// Single source of truth for the visual identity.
// Change colours here, then re-run the generators (see docs/SETUP.md).

export const T = {
  // Palette from the supplied reference image
  navyPrimary: '#0B2249',
  navyDeep: '#0C1F41',
  blueDark: '#133C6F',
  blueMid: '#2E5C93',
  blueLight: '#5985BD',
  // Restrained supplements for text and contrast
  text: '#E8EEF7',
  textMuted: '#9FB1C9',
  cyan: '#7FB7D6',
  pale: '#D6E2F2',
  other: '#6B7F9C',
  fontSans: "'Segoe UI', -apple-system, 'Helvetica Neue', Arial, sans-serif",
  fontMono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

// Language donut colours (labels + percentages always accompany them)
export const DONUT = [T.blueLight, T.cyan, T.blueMid, T.textMuted, T.pale];

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const fmt = (n) => new Intl.NumberFormat('en-US').format(n);

// Small deterministic PRNG so generated art is stable between runs
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function text(x, y, str, o = {}) {
  const { size = 13, fill = T.text, weight = 400, anchor = 'start', mono = false, spacing, opacity } = o;
  return `<text x="${x}" y="${y}" font-family="${mono ? T.fontMono : T.fontSans}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${
    spacing ? ` letter-spacing="${spacing}"` : ''
  }${opacity != null ? ` opacity="${opacity}"` : ''}>${esc(str)}</text>`;
}

export function cardOpen(id, w, h, title, desc) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-t ${id}-d">
<title id="${id}-t">${esc(title)}</title>
<desc id="${id}-d">${esc(desc)}</desc>
<defs><linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.navyDeep}"/><stop offset="1" stop-color="${T.navyPrimary}"/></linearGradient></defs>
<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="14" fill="url(#${id}-bg)" stroke="${T.blueDark}" stroke-width="1.5"/>`;
}

export const cardClose = '</svg>\n';
