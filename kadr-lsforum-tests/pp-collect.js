(opts) => {
  opts = opts || {};
  const TOL = opts.tol || 1;
  const parse = (c) => { if (!c) return null; let m = c.match(/^rgba?\(([^)]+)\)$/); if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; } if (c === 'transparent') return [0, 0, 0, 0]; return null; };
  const desc = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((x) => x && !/^kadr/.test(x)).slice(0, 3) : []; if (c.length) s += '.' + c.join('.'); return s; };
  const path = (el) => { const a = []; for (let n = el, i = 0; n && n !== document.body && i < 4; n = n.parentElement, i++) a.unshift(desc(n)); return a.join(' > '); };
  const vis = (el) => el.getClientRects().length && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true, opacityProperty: true }));
  const cv = document.createElement('canvas').getContext('2d');
  const fm = new Map();
  const metrics = (cs) => {
    const f = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if (fm.has(f)) return fm.get(f);
    cv.font = f;
    const H = cv.measureText('НH'), x = cv.measureText('хx');
    const r = { asc: H.fontBoundingBoxAscent, desc: H.fontBoundingBoxDescent, cap: H.actualBoundingBoxAscent, xh: x.actualBoundingBoxAscent };
    fm.set(f, r); return r;
  };
  const ownBox = (el, cs) => {
    if ((cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none')) return null;
    if (cs.transform && cs.transform !== 'none' && !/^matrix\(1, 0, 0, 1,/.test(cs.transform)) return null;
    if (/ipsLeaderboard_trophy/.test(el.className)) return null;
    const bg = parse(cs.backgroundColor);
    if (bg && bg[3] >= 0.05) return 'bg';
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return 'img';
    for (const s of ['Top', 'Right', 'Bottom', 'Left']) { const w = parseFloat(cs['border' + s + 'Width']); const c = parse(cs['border' + s + 'Color']); if (w >= 1 && cs['border' + s + 'Style'] !== 'none' && c && c[3] >= 0.15) return 'border'; }
    if (cs.boxShadow && cs.boxShadow !== 'none' && /inset 0px 0px 0px [1-9]|0px 0px 0px [1-9]/.test(cs.boxShadow)) return 'ring';
    return null;
  };
  const isIcon = (el) => { const cl = typeof el.className === 'string' ? el.className : ''; return /(^|\s)fa(\s|$)/.test(cl) || el.tagName === 'svg' || el.tagName === 'IMG' || /kadr-ico|kadr-lsp-toggle/.test(cl); };
  const out = { controls: [], text: [], rows: [], iconBoxes: [] };
  const all = [...document.body.querySelectorAll('*')].filter((el) => !el.closest('kadr-sheet, script, style, noscript, svg, template'));
  const cands = [];
  for (const el of all) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 12 || r.height > 72 || r.width < 12 || r.width > 640) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'inline' && !/^(A|BUTTON|SPAN)$/.test(el.tagName)) continue;
    if (!/^(A|BUTTON|LABEL|SPAN|LI|I|INPUT|SELECT)$/.test(el.tagName) && el.getAttribute('role') !== 'button' && !/ipsPageHeader|ipsType_sectionTitle|ipsWidget_title/.test(el.className)) continue;
    const box = ownBox(el, cs);
    if (!box) continue;
    if (box === 'img' && !/gradient/.test(cs.backgroundImage)) continue;
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
    const hasIcon = !!el.querySelector('.fa, svg, .kadr-ico') || (isIcon(el) && el.tagName !== 'IMG');
    const hasImg = !!el.querySelector('img') || el.tagName === 'IMG';
    if (hasImg && !text) continue;
    if (!text && !hasIcon) continue;
    if (text.length > 48) continue;
    cands.push({ el, r, cs, box, text, hasIcon, hasImg });
  }
  const candSet = new Set(cands.map((c) => c.el));
  const leaf = cands.filter((c) => { for (const o of candSet) if (o !== c.el && c.el.contains(o)) return false; return true; });
  const textBand = (el) => {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let top = Infinity, bot = -Infinity, left = Infinity, right = -Infinity, lines = new Set(), n;
    while ((n = tw.nextNode())) {
      const s = n.textContent.replace(/\s+/g, '');
      if (!s) continue;
      const pe = n.parentElement; if (!pe || !vis(pe)) continue;
      const pcs = getComputedStyle(pe);
      const pr = pe.getBoundingClientRect(); if (pr.width <= 2 || pr.height <= 2) continue;
      let hid = false; for (let q = pe; q && q !== el.parentElement; q = q.parentElement) { const qc = getComputedStyle(q); if ((qc.clip && qc.clip !== 'auto') || (qc.clipPath && qc.clipPath !== 'none') || (qc.position === 'absolute' && q.getBoundingClientRect().width <= 2)) { hid = true; break; } } if (hid) continue;
      if (pcs.fontSize === '0px' || parseFloat(pcs.opacity) === 0) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const rects = [...rg.getClientRects()].filter((q) => q.width > 0.5);
      if (!rects.length) continue;
      const m = metrics(pcs);
      const capish = /[A-ZА-ЯЁ0-9]/.test(s);
      for (const q of rects) {
        const base = q.top + m.asc;
        const t = base - (capish ? m.cap : m.xh);
        top = Math.min(top, t); bot = Math.max(bot, base);
        left = Math.min(left, q.left); right = Math.max(right, q.right);
        lines.add(Math.round(base));
      }
    }
    if (top === Infinity) return null;
    return { top, bot, left, right, lines: lines.size };
  };
  for (const c of leaf) {
    const { el, r, cs, box, text } = c;
    const bt = parseFloat(cs.borderTopWidth), bb = parseFloat(cs.borderBottomWidth), bl = parseFloat(cs.borderLeftWidth), br = parseFloat(cs.borderRightWidth);
    const inner = { top: r.top + bt, bottom: r.bottom - bb, left: r.left + bl, right: r.right - br };
    const rec = { d: desc(el), p: path(el), box, text: text.slice(0, 30), x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: +r.width.toFixed(1), h: +r.height.toFixed(1), radius: /%$/.test(cs.borderTopLeftRadius) ? parseFloat(cs.borderTopLeftRadius) * Math.min(r.width, r.height) / 100 : parseFloat(cs.borderTopLeftRadius) || 0 };
    out.controls.push(rec);
    if (text) {
      const b = textBand(el);
      if (b && b.lines === 1) {
        let top = b.top, bot = b.bot;
        for (const ic of el.querySelectorAll('.fa, svg, .kadr-ico')) { const q = ic.getBoundingClientRect(); if (!q.height) continue; if (q.bottom <= b.top + 2 || q.top >= b.bot - 2) { top = Math.min(top, q.top); bot = Math.max(bot, q.bottom); rec.stack = 1; } }
        const offV = ((top - inner.top) - (inner.bottom - bot)) / 2;
        rec.offV = +offV.toFixed(2);
        const centred = cs.textAlign === 'center' || cs.justifyContent === 'center' || (/flex/.test(cs.display) && cs.justifyContent === 'normal' && false);
        if (centred && !c.hasImg) { let l = b.left, rr = b.right; for (const ic of el.querySelectorAll('.fa, svg, .kadr-ico, img')) { const q = ic.getBoundingClientRect(); if (q.width) { l = Math.min(l, q.left); rr = Math.max(rr, q.right); } } const pl = parseFloat(cs.paddingLeft), prr = parseFloat(cs.paddingRight); if (Math.abs(pl - prr) < 0.5 && !el.querySelector('.ipsBadge, .ipsNotificationCount, [class*=count i]')) { const offH = ((l - inner.left) - (inner.right - rr)) / 2; rec.offH = +offH.toFixed(2); } }
        if (Math.abs(offV) > TOL) out.text.push({ ...rec, why: 'text ' + (offV < 0 ? 'high' : 'low') + ' by ' + Math.abs(offV).toFixed(1) + 'px' });
        if (rec.offH !== undefined && Math.abs(rec.offH) > TOL * 1.5) out.text.push({ ...rec, why: 'text ' + (rec.offH < 0 ? 'left' : 'right') + ' by ' + Math.abs(rec.offH).toFixed(1) + 'px' });
      }
    } else {
      let fx = false; for (let q = el; q && q !== document.body; q = q.parentElement) { const pc = getComputedStyle(q).position; if (pc === 'fixed' || pc === 'sticky') { fx = true; break; } }
      out.iconBoxes.push({ ...rec, inFixed: fx, cx: r.left + r.width / 2 + scrollX, cy: r.top + r.height / 2 + scrollY, rx: r.left + scrollX, ry: r.top + scrollY, rw: r.width, rh: r.height, bt, bl, br, bb });
    }
  }
  const groups = new Map();
  for (const c of leaf) {
    let p = c.el.parentElement;
    if (p && p.children.length === 1 && !ownBox(p, getComputedStyle(p))) p = p.parentElement;
    if (!p) continue;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(c);
  }
  for (const [p, list] of groups) {
    if (list.length < 2) continue;
    const used = new Set();
    for (const a of list) {
      if (used.has(a)) continue;
      const row = [a]; used.add(a);
      for (const b of list) { if (used.has(b)) continue; const ov = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top); if (ov > Math.min(a.r.height, b.r.height) * 0.5) { row.push(b); used.add(b); } }
      if (row.length < 2) continue;
      const cys = row.map((x) => x.r.top + x.r.height / 2), hs = row.map((x) => x.r.height);
      const dc = Math.max(...cys) - Math.min(...cys), dh = Math.max(...hs) - Math.min(...hs);
      const btn = row.filter((x) => /^(A|BUTTON|LABEL|SPAN|LI)$/.test(x.el.tagName));
      if (dc > TOL || (btn.length >= 2 && dh > TOL)) out.rows.push({ parent: path(p), n: row.length, dc: +dc.toFixed(2), dh: +dh.toFixed(2), items: row.map((x) => desc(x.el) + ' «' + x.text.slice(0, 14) + '» h' + x.r.height.toFixed(1) + ' cy' + (x.r.top + x.r.height / 2 + scrollY).toFixed(1)), y: Math.round(Math.min(...row.map((x) => x.r.top)) + scrollY) });
    }
  }
  out.counts = { controls: out.controls.length, leaf: leaf.length };
  return out;
}
