(function () {
  var m = /[#&]kadrtest=([^&]+)/.exec(location.hash);
  if (!m) return;
  try { var s = JSON.parse(decodeURIComponent(m[1])); chrome.storage.local.clear(function () { chrome.storage.local.set(s); }); } catch (e) {}
})();
