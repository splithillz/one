const B = 'https://forum.ls-project.com';
const STATES = {
  off: { theme: 'off', skin: false },
  mint: { theme: 'mint', skin: true },
  white: { theme: 'monet-white', skin: true },
  glass: { theme: 'grape', skin: true, fx: 'glass', icons: 'solar' },
  material: { theme: 'rose', skin: true, fx: 'material', icons: 'remix', postSize: 'xl' },
  sysblack: { theme: 'monet-black', skin: true, scheme: 'system' },
  custom: { theme: 'custom', seed: '#ff8800', skin: true, shadows: false }
};
const PAGES = [['index', '/'], ['topics', '/index.php?/forum/34-x/'], ['t34', '/index.php?/topic/34-x/'], ['t35', '/index.php?/topic/35-x/'], ['t838', '/index.php?/topic/838-x/'], ['profile', '/index.php?/profile/92-x/'], ['staff', '/index.php?/staff/'], ['online', '/index.php?/online/']];
const UA_PHONE_FF = 'Mozilla/5.0 (Android 14; Mobile; rv:160.0) Gecko/160.0 Firefox/160.0';
function probe() {
  const d = document.documentElement, b = document.body;
  const cs = (e, p) => (e ? getComputedStyle(e)[p] : null);
  const first = (sels) => { for (const s of sels) { const e = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0); if (e) return e; } return null; };
  const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top + scrollY), Math.round(q.width), Math.round(q.height)]; };
  const card = first(['#ipsLayout_mainArea .ipsBox', '#ipsLayout_mainArea .cForumList .ipsDataList', '#ipsLayout_mainArea .ipsWidget', 'article.cPost']);
  const btn = first(['#ipsLayout_mainArea .ipsButton_primary', '#ipsLayout_mainArea .ipsButton_important', '.ipsButton_primary', '.ipsButton_important']);
  const post = document.querySelector('article.cPost [data-role="commentContent"]');
  const lift = document.getElementById('kadr-lift'), fit = document.getElementById('kadr-fit');
  const ic = first(['#ipsLayout_mainArea i.fa', '#ipsLayout_header i.fa', 'i.fa']);
  const icb = ic ? getComputedStyle(ic, '::before') : null;
  return {
    rd: d.classList.contains('kadr-rd'), scheme: d.getAttribute('data-focus-scheme'), cls: [...d.classList].filter((c) => /^kadr-/.test(c)).sort().join(' '),
    fs: d.getAttribute('data-kadr-fs'), acc: getComputedStyle(d).getPropertyValue('--theme-brand_primary').trim(),
    bodyBg: cs(b, 'backgroundColor'), text: cs(b, 'color'), font: (cs(b, 'fontFamily') || '').split(',')[0].trim().replace(/"/g, ''), onest: document.fonts.check('16px Onest'),
    cardBg: cs(card, 'backgroundColor'), cardRadius: cs(card, 'borderTopLeftRadius'), cardFilter: card ? (cs(card, 'backdropFilter') || 'none') : null,
    btnBg: cs(btn, 'backgroundColor'), btnColor: cs(btn, 'color'), postFs: cs(post, 'fontSize'),
    liftRules: lift ? (lift.textContent.match(/\{/g) || []).length : 0, fitRules: fit ? (fit.textContent.match(/\{/g) || []).length : 0,
    wide: d.scrollWidth > innerWidth + 1 || (() => { const vw = innerWidth; let n = 0; for (const el of document.body.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.width <= 0 || r.right <= vw + 1 || r.left >= vw || getComputedStyle(el).position === 'fixed') continue; let c = false; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(p).overflowX)) { c = true; break; } if (!c) n++; } return n; })() > 0, entry: !!document.querySelector('[data-kadr-entry]'),
    icon: icb ? ((icb.maskImage && icb.maskImage !== 'none') || (icb.webkitMaskImage && icb.webkitMaskImage !== 'none') ? 'mask' : 'font:' + (icb.fontFamily || '').split(',')[0].replace(/"/g, '')) : null,
    cardBox: r(card), header: r(document.querySelector('#ipsLayout_header')), mainBox: r(document.querySelector('#ipsLayout_mainArea')),
    vw: innerWidth, colors: [...document.body.querySelectorAll('[style*="color"]')].slice(0, 300).map((e) => [e.tagName + '|' + e.getAttribute('style') + '|' + (e.textContent || '').trim().slice(0, 24), getComputedStyle(e).color])
  };
}
module.exports = { B, STATES, PAGES, UA_PHONE_FF, probe };
