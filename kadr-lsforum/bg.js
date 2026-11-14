var VER = chrome.runtime.getManifest().version;
function verNum(v) { var p = String(v || '').split('.'); return (+p[0] || 0) * 1e6 + (+p[1] || 0) * 1e3 + (+p[2] || 0); }
function paint(v) {
  var on = !!v && verNum(v) > verNum(VER);
  chrome.action.setBadgeText({ text: on ? '1' : '' });
  if (on) chrome.action.setBadgeBackgroundColor({ color: '#ff5a4f' });
  chrome.action.setTitle({ title: on ? 'Kadr — вышла версия ' + v : 'Kadr — LS Project Forum Themes' });
}
function init() { chrome.storage.local.get('updLatest', function (d) { paint(d && d.updLatest); }); }
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);
chrome.storage.onChanged.addListener(function (ch, area) { if (area === 'local' && ch.updLatest) paint(ch.updLatest.newValue); });
