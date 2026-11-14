const BASE = 'https://forum.ls-project.com';
module.exports = {
  BASE,
  PAGES: [
    ['index', '/'],
    ['category', '/index.php?/forum/4-информационный-раздел/'],
    ['forum', '/index.php?/forum/5-серверная-информация/'],
    ['topics', '/index.php?/forum/34-сервер/'],
    ['news', '/index.php?/forum/69-новости-проекта/'],
    ['topic', '/index.php?/topic/47-лог-обновлений/'],
    ['topic2', '/index.php?/topic/838-баг-с-подселённым-домом/'],
    ['profile', '/index.php?/profile/92-nor7hwes7/'],
    ['online', '/index.php?/online/'],
    ['discover', '/index.php?/discover/'],
    ['search', '/index.php?/search/'],
    ['login', '/index.php?/login/'],
    ['register', '/index.php?/register/'],
    ['staff', '/index.php?/staff/'],
    ['leaderboard', '/index.php?/leaderboard/']
  ].map(([n, p]) => [n, BASE + encodeURI(p).replace(/%25/g, '%')])
};
