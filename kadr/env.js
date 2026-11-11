// Кадр: режим интерфейса — до первой отрисовки, чтобы ничего не прыгало.
// .touch — телефон или планшет: вёрстка на всю ширину и крупные цели для пальца.
// Медиазапросу (hover/pointer) верим не всегда: некоторые мобильные браузеры отдают в попап «мышь»,
// поэтому дублируем проверкой по UA. На компьютере попап остаётся 380px.
(function (d) {
  var root = d.documentElement, touch = false;
  try { touch = matchMedia('(hover: none) and (pointer: coarse)').matches; } catch (e) {}
  if (!touch) touch = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || !!(navigator.userAgentData && navigator.userAgentData.mobile);
  if (touch) root.classList.add('touch');
  // Шторка внутри kinoarc (iframe из content.js).
  if (location.hash === '#sheet') root.setAttribute('data-mode', 'sheet');
})(document);
