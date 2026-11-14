const [, , ffPath, crPath] = process.argv;
const F = require(require('path').resolve(ffPath)), C = require(require('path').resolve(crPath));
const exact = ['rd', 'scheme', 'cls', 'fs', 'acc', 'bodyBg', 'text', 'font', 'onest', 'cardBg', 'cardRadius', 'btnBg', 'btnColor', 'postFs', 'entry', 'icon', 'cardFilter'];
let n = 0, fails = 0, colours = 0, colourDiff = 0;
const fail = (m) => { fails++; console.log('FAIL ' + m); };
for (const k of Object.keys(C)) {
  const f = F[k], c = C[k], off = k.includes('|off|');
  if (!f) { fail(k + ': missing in Firefox'); continue; }
  n++;
  for (const p of exact) if (JSON.stringify(f[p]) !== JSON.stringify(c[p])) fail(`${k}: ${p} firefox ${JSON.stringify(f[p])} chromium ${JSON.stringify(c[p])}`);
  for (const p of ['cardBox', 'header', 'mainBox']) {
    const a = f[p], b = c[p];
    if (!a || !b) { if (!a !== !b) fail(`${k}: ${p} present only in one browser`); continue; }
    if (Math.abs(a[0] - b[0]) > 3 || Math.abs(a[2] - b[2]) > 3) fail(`${k}: ${p} firefox ${JSON.stringify(a)} chromium ${JSON.stringify(b)}`);
  }
  if (!off && (f.wide || f.vw !== c.vw)) fail(`${k}: page wider than the screen (firefox wide ${f.wide}, width ${f.vw} vs ${c.vw})`);
  const mc = new Map(c.colors.map(([a, b]) => [a, b]));
  for (const [key, col] of f.colors) if (mc.has(key)) { colours++; if (mc.get(key) !== col) { colourDiff++; fail(`${k}: colour of ${key.slice(0, 60)} firefox ${col} chromium ${mc.get(key)}`); } }
}
console.log(`firefox-vs-chromium: ${n} page states, ${colours} element colours, ${fails} failures`);
