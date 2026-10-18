/* ==========================================================================
   Плавная прокрутка страницы.

   Колесо мыши двигает страницу ступеньками: один щелчок — сразу сотня
   пикселей. Всё, что привязано к позиции прокрутки — первый экран, уезжающий
   с ролика, курсор-кнопка над видео — от этого едет рывками.

   Поэтому колесо браузеру не отдаётся: щелчки копятся в целевой позиции,
   а страница догоняет её кадр за кадром через window.scrollTo с дробным
   значением. Двигается именно прокрутка, а не контент: липкие элементы,
   шкалы view-timeline и любые замеры getBoundingClientRect остаются
   честными, и разъехаться с прокруткой ничто не может.

   Отсюда правило против дрожи: всё, что считается от позиции скролла,
   пересчитывается в этом же кадре и сразу после сдвига — для этого есть
   smooth.onFrame(). Подписка по событию scroll отстаёт на кадр, и на
   курсоре над роликом это отставание видно как микродрожание.

   На тач-устройствах и при prefers-reduced-motion не включается: там своя
   инерция, перехватывать её нечем и незачем. Тогда smooth.active === false,
   а smooth.to() просто зовёт родную прокрутку.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var frameJobs = [];

  var api = {
    active: false,
    /* пересчитать что-то в том же кадре, где сдвинулась прокрутка */
    onFrame: function (fn) { frameJobs.push(fn); },
    to: function (y) { window.scrollTo(0, y); },
    /* позиция прокрутки с дробной частью: браузер округляет scrollY до пикселя,
       и то, что едет от прокрутки по горизонтали (дорожка «Пути гостя»), дрожало бы на ±1px */
    y: function () { return window.scrollY; }
  };
  window.smooth = api;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;
  if (reduced || !fine) return;

  api.active = true;
  api.y = function () { var s = window.scrollY; return Math.abs(pos - s) < 1 ? pos : s; };
  root.classList.add('is-vscroll');   /* снимает scroll-behavior: smooth */

  /* Догоняет цель критически затухающей пружиной, а не простым «сокращением разрыва»:
     при прежнем способе (exp, 11/с) скорость на каждом щелчке колеса прыгала скачком и тут же гасла —
     на горизонтальной дорожке «Пути гостя» это читалось как рывки. У пружины скорость меняется непрерывно,
     средняя задержка та же (2/W ≈ 0,09 с), перелёта нет. */
  var W = 22;           /* жёсткость, 1/с */
  var SETTLE = 0.05;    /* ближе этого к цели (и почти без скорости) считаем, что приехали */
  var LINE = 40;        /* сколько пикселей в одной «строке» wheel-события */

  var target = window.scrollY;   /* куда едем */
  var pos = target;              /* где сейчас, с дробной частью */
  var vel = 0;                   /* скорость, px/с */
  var own = -1;                  /* что выставили сами: чужой скролл ловим по этому */
  var last = performance.now();
  var running = false;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function limit() { return Math.max(0, root.scrollHeight - window.innerHeight); }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }

  /* перед новым движением подхватываем реальную позицию: пока мы стояли,
     страницу могли прокрутить мимо нас — скроллбаром, поиском, табом */
  function sync() {
    if (!running) { pos = target = window.scrollY; vel = 0; }
  }

  function tick(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    target = clamp(target, 0, limit());

    /* точное решение пружины на шаге dt — не зависит от частоты кадров */
    var e = pos - target, k = vel + W * e, ex = Math.exp(-W * dt);
    pos = target + (e + k * dt) * ex;
    vel = (vel - W * k * dt) * ex;
    if (Math.abs(target - pos) < SETTLE && Math.abs(vel) < 6) { pos = target; vel = 0; running = false; }

    window.scrollTo(0, pos);
    own = window.scrollY;   /* браузер округляет по-своему, дробную часть держим у себя */

    for (var i = 0; i < frameJobs.length; i++) frameJobs[i]();

    if (running) requestAnimationFrame(tick);
  }

  /* чужая прокрутка: скроллбар, поиск по странице, переход по фокусу */
  window.addEventListener('scroll', function () {
    if (running && Math.abs(window.scrollY - own) < 2) return;   /* это мы сами */
    if (!running) { pos = target = window.scrollY; vel = 0; }
  }, { passive: true });

  window.addEventListener('resize', function () {
    target = clamp(target, 0, limit());
  });

  /* Если внутри страницы появятся свои прокручиваемые области,
     над ними колесо остаётся браузерным. */
  function scrollableUnder(node, dy) {
    for (var el = node; el && el.nodeType === 1 && el !== document.body && el !== root; el = el.parentElement) {
      if (el.scrollHeight - el.clientHeight < 2) continue;
      var oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      if (dy > 0 ? el.scrollTop < el.scrollHeight - el.clientHeight - 1 : el.scrollTop > 1) return true;
    }
    return false;
  }

  /* открыт полный просмотр ролика — страница стоит */
  function locked() { return root.classList.contains('is-locked') || document.body.classList.contains('is-locked'); }

  window.addEventListener('wheel', function (e) {
    if (e.ctrlKey || e.defaultPrevented) return;                  /* ctrl+колесо — это зум */
    /* открыто окно (запись, врач, статья): листается только оно, страница под ним стоит */
    if (locked()) { if (!scrollableUnder(e.target, e.deltaY)) e.preventDefault(); return; }
    if (scrollableUnder(e.target, e.deltaY)) return;

    var d = e.deltaY * (e.deltaMode === 1 ? LINE : e.deltaMode === 2 ? window.innerHeight : 1);
    if (!d) return;

    e.preventDefault();
    sync();
    target = clamp(target + d, 0, limit());
    start();
  }, { passive: false });

  var TYPING = /^(input|textarea|select)$/i;

  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || locked()) return;
    var t = e.target;
    if (t && t.nodeType === 1 && (TYPING.test(t.tagName) || t.isContentEditable)) return;

    var vh = window.innerHeight, d;
    switch (e.key) {
      case 'ArrowDown': d = 90; break;
      case 'ArrowUp':   d = -90; break;
      case 'PageDown':  d = vh * 0.85; break;
      case 'PageUp':    d = -vh * 0.85; break;
      case ' ':         d = (e.shiftKey ? -1 : 1) * vh * 0.85; break;
      case 'Home':      d = -Infinity; break;
      case 'End':       d = Infinity; break;
      default: return;
    }

    e.preventDefault();
    sync();
    target = clamp(target + d, 0, limit());
    start();
  });

  /* якоря в меню и кнопках ведут сюда же — одним и тем же движением */
  api.to = function (y) {
    sync();
    target = clamp(y, 0, limit());
    start();
  };
})();
