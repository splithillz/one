const fs = require('fs'), path = require('path');
const BASE = 'https://forum.ls-project.com';
async function isGuest(page) { return page.evaluate(() => document.documentElement.hasAttribute('data-focus-guest')); }
const GUARD = { open: false, blocked: [] };
const DENY = /[?&]do=(delete|hide|unhide|lock|unlock|pin|unpin|feature|unfeature|move|merge|split|react|unreact|unfollow|mark|read|unread|approve|unapprove|solve|unsolve|vote|rate|ignore|unignore|toggle|leave|block|unblock|remove|empty|disable|enable|stop|dismiss|clear|reset|logout|recommend|unrecommend|warn|ban|flag|setBest|changeAuthor|archive|unarchive)\w*/i;
async function guard(ctx) {
  if (ctx.__kadrGuard) return;
  ctx.__kadrGuard = true;
  await ctx.route('**/*', (route) => {
    const req = route.request(), u = req.url(), m = req.method();
    if (!u.startsWith(BASE) || GUARD.open) return route.fallback();
    const rel = u.slice(BASE.length);
    if (/^\/(uploads|applications|public|static|themes|cdn-cgi\/scripts)\/|\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ico)(\?|$)/i.test(rel) && m === 'GET') return route.fallback();
    const write = (m !== 'GET' && m !== 'HEAD') || /controller=notifications|\/notifications\//i.test(u) || DENY.test(u) || /[?\/]logout\b|do=logout/i.test(rel);
    if (write) { let body = ''; try { body = (req.postData() || '').replace(/csrfKey=[^&]+/ig, 'csrfKey=…').replace(/(password|auth)=[^&]*/ig, '$1=…').slice(0, 160); } catch (e) {} GUARD.blocked.push(m + ' ' + decodeURIComponent(u.replace(BASE, '')).replace(/csrfKey=[^&]+/i, 'csrfKey=…').slice(0, 150) + (body ? ' BODY ' + body : '')); return route.abort('blockedbyclient'); }
    return route.fallback();
  });
}
function guardReport() { const c = {}; for (const b of GUARD.blocked) { const k = b.replace(/\d{2,}/g, '#').replace(/ BODY .*$/, '').replace(/&.*$/, ''); c[k] = (c[k] || 0) + 1; } return c; }
function guardBodies() { return [...new Set(GUARD.blocked.filter((b) => / BODY /.test(b) && !/cdn-cgi/.test(b)).map((b) => b.replace(/\d{3,}/g, '#')))]; }
async function login(ctx) {
  if (!process.env.KADR_CRED) throw new Error('set KADR_CRED to the path of a JSON file {"user":"…","pass":"…"} kept outside the repository');
  const cred = JSON.parse(fs.readFileSync(process.env.KADR_CRED, 'utf8'));
  await guard(ctx);
  GUARD.open = true;
  try { return await loginInner(ctx, cred); } finally { GUARD.open = false; }
}
async function loginInner(ctx, cred) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.php?/login/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(800);
  if (!(await isGuest(page))) { await page.close(); return true; }
  const form = page.locator('form[method="post"]').filter({ has: page.locator('input[type="password"]') }).last();
  if (await page.locator('.g-recaptcha, [data-sitekey], .h-captcha').count()) throw new Error('captcha on the login form');
  await form.locator('input[name="auth"]').fill(cred.user);
  await form.locator('input[name="password"]').fill(cred.pass);
  const remember = form.locator('input[type="checkbox"][name*="remember"]');
  if (await remember.count()) await remember.first().evaluate((c) => { if (c.checked) c.click(); });
  await form.locator('button[type="submit"], input[type="submit"]').first().click();
  await page.waitForURL((u) => !/login/.test(String(u)), { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(2500);
  let guest = true;
  for (let i = 0; i < 4; i++) { try { guest = await isGuest(page); break; } catch (e) { await page.waitForTimeout(1500); } }
  await page.close();
  if (guest) throw new Error('login failed');
  return true;
}
async function logout(ctx) {
  GUARD.open = true;
  try { return await logoutInner(ctx); } finally { GUARD.open = false; }
}
async function logoutInner(ctx) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
  const href = await page.evaluate(() => { const a = document.querySelector('a[href*="/logout/"], a[href*="do=logout"]'); return a ? a.href : null; });
  if (href) { await page.goto(href, { waitUntil: 'load', timeout: 60000 }).catch(() => {}); await page.waitForTimeout(1200); }
  const guest = await isGuest(page).catch(() => null);
  await page.close();
  return { hadLink: !!href, guest };
}
module.exports = { login, logout, isGuest, BASE, guard, guardReport, guardBodies, GUARD };
