(function (d) {
  var root = d.documentElement, touch = false;
  try { touch = matchMedia('(hover: none) and (pointer: coarse)').matches; } catch (e) {}
  if (!touch) touch = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || !!(navigator.userAgentData && navigator.userAgentData.mobile);
  if (touch) root.classList.add('touch');
  if (/^#sheet/.test(location.hash)) root.setAttribute('data-mode', 'sheet');
})(document);
