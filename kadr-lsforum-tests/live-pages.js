const { BASE } = require('./pages');
const P = (p) => BASE + encodeURI(p).replace(/%25/g, '%');
async function authPages(ctx) {
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
  const me = await p.evaluate(() => { const a = document.querySelector('#elUserLink_menu a[href*="/profile/"], #elMobileDrawer a[href*="/profile/"]'); return a ? a.href.replace(/#.*$/, '') : null; });
  await p.goto(BASE + '/index.php?/messenger/', { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(1200);
  const conv = await p.evaluate(() => { for (const li of document.querySelectorAll('#elInboxContent > li, [data-role="messageList"] li')) { const a = li.querySelector('a[href*="/messenger/"]'); if (a && !/unread/i.test(li.className) && !li.querySelector('.ipsItemStatus_new, .ipsDataItem_unread')) return a.href; } return null; });
  let mytopic = null;
  if (me) { await p.goto(me.replace(/\/?$/, '/') + 'content/&type=forums_topic', { waitUntil: 'load', timeout: 60000 }); mytopic = await p.evaluate(() => { const a = [...document.querySelectorAll('#ipsLayout_mainArea a[href*="/topic/"]')].find((x) => x.textContent.trim().length > 2); return a ? a.href.replace(/#.*$/, '').replace(/&do=.*$/, '') : null; }); }
  await p.close();
  const list = [
    ['index', BASE + '/'], ['category', P('/index.php?/forum/4-информационный-раздел/')], ['forum', P('/index.php?/forum/5-серверная-информация/')],
    ['topics', P('/index.php?/forum/34-сервер/')], ['news', P('/index.php?/forum/69-новости-проекта/')], ['topic', P('/index.php?/topic/47-лог-обновлений/')],
    ['topic2', P('/index.php?/topic/838-баг-с-подселённым-домом/')], ['mytopic', mytopic],
    ['discover', BASE + '/index.php?/discover/'], ['unread', BASE + '/index.php?/discover/unread/'], ['online', BASE + '/index.php?/online/'],
    ['search', P('/index.php?/search/&q=сервер')], ['staff', BASE + '/index.php?/staff/'], ['leaderboard', BASE + '/index.php?/leaderboard/'],
    ['me', me], ['me-content', me ? me.replace(/\/?$/, '/') + 'content/' : null], ['settings', BASE + '/index.php?/settings/'], ['followed', BASE + '/index.php?/followed/'],
    ['messenger', BASE + '/index.php?/messenger/'], ['conv', conv], ['add-topic', P('/index.php?/forum/34-сервер/&do=add')],
  ];
  return list.filter((x) => x[1]);
}
module.exports = { authPages };
