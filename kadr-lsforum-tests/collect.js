(opts) => {
  opts = opts || {};
  const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION', 'TEMPLATE', 'IFRAME', 'HEAD', 'TITLE', 'META', 'LINK', 'BR']);
  const ours = (el) => !!(el.closest && el.closest('kadr-sheet, [data-kadr-entry]'));
  const parse = (c) => {
    if (!c) return null;
    let m = c.match(/^rgba?\(([^)]+)\)$/);
    if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
    m = c.match(/^color\(srgb ([^)]+)\)$/);
    if (m) { const p = m[1].split(/[\s\/]+/).filter(Boolean).map(parseFloat); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
    if (c === 'transparent') return [0, 0, 0, 0];
    return null;
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const desc = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cl = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((c) => c && !/^kadr/.test(c)).slice(0, 2) : [];
    if (cl.length) s += '.' + cl.join('.');
    return s;
  };
  const ownText = (el) => { let t = ''; for (const n of el.childNodes) if (n.nodeType === 3) t += n.textContent; return t.replace(/\s+/g, ' ').trim(); };
  const vw = innerWidth;
  const out = { vw, sw: document.documentElement.scrollWidth, wide: [], texts: [], skipped: 0 };

  const bgCache = new Map();
  const R0 = document.documentElement, rcs = getComputedStyle(R0);
  const glass = R0.classList.contains("kadr-rd") && R0.classList.contains("kadr-fx-glass");
  const blobRGB = glass ? rcs.getPropertyValue("--theme-brand_primary").split(",").map(parseFloat) : null;
  const blobK = glass ? parseFloat(rcs.getPropertyValue("--k-blob")) || 0.22 : 0;
  const VW = innerWidth, VH = innerHeight, VM = Math.max(VW, VH) / 100;
  const SPOTS = [[1, .3, 54, 42, 1], [0, .68, 48, 40, .8], [.62, 1.06, 70, 36, .65]];
  const spotAt = (x, y) => { let keep = 1; for (const [cx, cy, rx, ry, m] of SPOTS) { const d = Math.hypot((x - cx * VW) / (rx * VM), (y - cy * VH) / (ry * VM)); keep *= 1 - blobK * m * Math.max(0, 1 - d / 0.7); } return 1 - keep; };
  const DH = document.documentElement.scrollHeight, SY = scrollY;
  const worstSpot = (el) => { const r = el.getBoundingClientRect(); const yc = r.top + r.height / 2 + SY; const lo = Math.max(0, yc - Math.max(0, DH - VH)), hi = Math.min(VH, Math.max(lo, yc)); let w = 0; for (let i = 0; i <= 8; i++) { const x = Math.min(VW, Math.max(0, r.left + (r.right - r.left) * i / 8)); for (let k = 0; k <= 40; k++) w = Math.max(w, spotAt(x, lo + (hi - lo) * k / 40)); } return w; };
  function bgOf(el) {
    if (bgCache.has(el)) return bgCache.get(el);
    const layers = [];
    let res = null, n = el;
    for (; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') { res = null; layers.length = 0; layers.push('img'); break; }
      const c = parse(cs.backgroundColor);
      if (!c) { layers.length = 0; layers.push('img'); break; }
      if (c[3] > 0) { layers.push(c); if (c[3] >= 0.999) break; }
    }
    if (glass && layers[0] !== 'img' && (!n || n.nodeType !== 1 || n === document.body || n === R0)) { const blob = [...blobRGB, worstSpot(el)]; if (n && n.nodeType === 1) layers.splice(layers.length - 1, 0, blob); else layers.push(blob); }
    if (layers[0] !== 'img') {
      let base = [255, 255, 255];
      for (let i = layers.length - 1; i >= 0; i--) { const L = layers[i]; base = [0, 1, 2].map((j) => L[j] * L[3] + base[j] * (1 - L[3])); }
      res = base;
    }
    bgCache.set(el, res);
    return res;
  }
  const opac = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };

  const all = document.body ? document.body.querySelectorAll('*') : [];
  const palette = { bg: {}, border: {}, text: {} };
  const addPal = (kind, c, el) => { if (!c || c[3] === 0) return; const k = c.slice(0, 3).map(Math.round).join(',') + (c[3] < 1 ? '/' + c[3].toFixed(2) : ''); const p = palette[kind]; if (!p[k]) p[k] = { n: 0, ex: desc(el) }; p[k].n++; };
  const seen = {};
  for (const el of all) {
    if (skipTags.has(el.tagName) || ours(el) || el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const cs = getComputedStyle(el);
    if (r.right > vw + 1 && r.left < vw && cs.position !== 'fixed') {
      let clipped = false;
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n); if (/(hidden|clip|auto|scroll)/.test(o.overflowX)) { clipped = true; break; } }
      if (!clipped && out.wide.length < 8) out.wide.push(desc(el) + ' right=' + Math.round(r.right));
    }
    if (opts.palette) {
      if (!cs.backgroundImage || cs.backgroundImage === 'none') addPal('bg', parse(cs.backgroundColor), el);
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none') addPal('border', parse(cs['border' + side + 'Color']), el);
    }
    const t = ownText(el);
    if (!t || cs.fontSize === '0px') continue;
    if (r.right < 0 || r.left > vw) continue;
    const fg = parse(cs.color);
    if (opts.palette && !(el.style && el.style.color)) addPal('text', fg, el);
    if (!fg) { out.skipped++; continue; }
    const o = opac(el);
    if (o < 0.05 || fg[3] === 0) continue;
    const bg = bgOf(el);
    if (!bg) { out.skipped++; continue; }
    const a = fg[3] * o, fgc = [0, 1, 2].map((j) => fg[j] * a + bg[j] * (1 - a));
    const text = t.slice(0, 40);
    const k0 = el.tagName + '|' + text;
    seen[k0] = (seen[k0] || 0) + 1;
    out.texts.push({ k: k0 + '|' + seen[k0], k2: el.tagName + '|' + text.replace(/\d+/g, '#'), r: +ratio(fgc, bg).toFixed(2), d: desc(el), t: text.slice(0, 30), fs: parseFloat(cs.fontSize), fg: fgc.map(Math.round).join(','), bg: bg.map(Math.round).join(','), par: el.parentElement ? desc(el.parentElement) : '' });
  }
  if (opts.palette) out.palette = palette;

  if (opts.vars) {
    const names = new Set();
    const walk = (rules) => { for (const r of rules) { if (r.cssRules && !r.selectorText) { try { walk(r.cssRules); } catch (e) {} continue; } if (r.style) for (let i = 0; i < r.style.length; i++) { const p = r.style[i]; if (p.startsWith('--theme-')) names.add(p); } } };
    for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (e) {} }
    const cs = getComputedStyle(document.documentElement);
    out.vars = {};
    [...names].sort().forEach((n) => { out.vars[n] = cs.getPropertyValue(n).trim(); });
  }

  if (opts.styles) {
    const props = ['color', 'background-color', 'background-image', 'font-family', 'font-size', 'font-weight', 'border-top-color', 'border-top-width', 'border-radius', 'box-shadow', 'display', 'position', 'opacity', 'padding', 'margin'];
    const snap = {};
    const path = (el) => { const parts = []; for (let n = el; n && n !== document.body; n = n.parentElement) { let i = 0; for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (!(s.matches && s.matches('[data-kadr-entry], kadr-sheet'))) i++; parts.push(n.tagName + i); } return parts.reverse().join('/'); };
    for (const el of all) {
      if (skipTags.has(el.tagName) || ours(el)) continue;
      const cs = getComputedStyle(el);
      snap[path(el)] = [desc(el), props.map((p) => cs.getPropertyValue(p).slice(0, 70)).join(' ; ')];
    }
    out.styles = snap;
  }
  return out;
}
