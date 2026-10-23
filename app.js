/* ==========================================================================
   Центр коррекции зрения доктора Кольцова — поведение страницы.

   Всё, что привязано к прокрутке, считается в одном кадре frame():
   плавная прокрутка (smooth.js) зовёт его сразу после сдвига, без неё —
   событие scroll. Анимации появления — IntersectionObserver.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var easeIO = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var vw = innerWidth, vh = innerHeight;
  var rem = function () { return parseFloat(getComputedStyle(root).fontSize); };

  /* ── телефон (≤ 900 px, mobile.css): свои раскладки блоков. Режим пересчитывается при смене ширины
        (поворот планшета) — всё, что ПК пишет в style, на телефоне сбрасывается, и наоборот ── */
  var mqM = window.matchMedia('(max-width: 900px), (max-width: 1199px) and (orientation: portrait)');   // как media у mobile.css в index.html
  var MOB = mqM.matches;
  root.classList.toggle('is-mob', MOB);
  var fpx = function () { return Math.min(vw / 390, 1.2); };   // 1px кадра телефона 390 (mobile.css: --f)
  // ролики с двумя версиями (data-src / data-src-m): на телефоне — свои кропы, легче в 2–5 раз
  function pickSrc(v) {
    var m = MOB && v.hasAttribute('data-src-m');
    var k = m ? (innerWidth >= 600 && v.hasAttribute('data-src-t') ? '-t' : '-m') : '';   // планшет — свой широкий кадр
    var p = v.getAttribute('data-poster' + k), s = v.getAttribute('data-src' + k);
    if (m && v.hasAttribute('data-preload-m')) v.preload = v.getAttribute('data-preload-m');   // ролик модели — не при открытии, а когда блок на экране
    if (p && v.getAttribute('poster') !== p) v.setAttribute('poster', p);
    if (s && v.getAttribute('src') !== s) { var on = !v.paused; v.src = s; if (on) { var pr = v.play(); if (pr) pr.catch(function () {}); } }
  }
  $$('video[data-src-m]').forEach(pickSrc);
  // прокрутка без анимации, даже при html{scroll-behavior:smooth}
  function jump(y) { root.style.scrollBehavior = 'auto'; window.scrollTo(0, y); root.style.scrollBehavior = ''; }

  /* ── раскрытие на телефоне (строки «С чем приходят», вопросы): открыт один пункт. Если закрывается пункт выше
        нажатого, он схлопывается сразу, а прокрутка компенсируется — нажатая строка остаётся под пальцем.
        Раскрытый пункт, оказавшийся низко, мягко поднимается к верху экрана ── */
  function accToggle(items, it, after) {
    var open = !it.classList.contains('is-open');
    var prev = items.filter(function (x) { return x !== it && x.classList.contains('is-open'); })[0];
    if (prev) {
      if (MOB && open && (prev.compareDocumentPosition(it) & 4)) {
        var t0 = it.getBoundingClientRect().top;
        prev.classList.add('is-snap');
        prev.classList.remove('is-open');
        jump(window.scrollY + it.getBoundingClientRect().top - t0);
        requestAnimationFrame(function () { requestAnimationFrame(function () { prev.classList.remove('is-snap'); }); });
      } else prev.classList.remove('is-open');
      if (after) after(prev, false);
    }
    it.classList.toggle('is-open', open);
    if (after) after(it, open);
    if (MOB && open) setTimeout(function () {
      var r = it.getBoundingClientRect(), top = Math.max(64, vh * .1);
      if (r.top > vh * .5 || r.top < top - 8) window.scrollTo({ top: window.scrollY + r.top - top, behavior: reduced ? 'auto' : 'smooth' });
    }, 60);
  }

  /* ── данные из админки (window.SITE в index.html): специалисты, случаи, статьи, часы работы ── */
  var SITE = window.SITE || {};

  /* ── мессенджеры и ссылки: адреса подставляет админка при сборке; пока ссылки нет (href="#") — клик никуда не уводит ── */
  $$('[data-msg]').forEach(function (a) {
    if (a.getAttribute('href') !== '#') return;
    a.addEventListener('click', function (e) { e.preventDefault(); });
  });

  /* ═════════ появления блоков 4–11 (sections.css) ═════════
     .rv — подъём из прозрачности, .rv-shot — шторка кадра, data-in — только класс; строки заголовков
     открываются вместе с самим заголовком. Срабатывает, когда элемент поднялся над нижними 5 % окна. */
  // кадр под шторкой (clip-path до нуля) наблюдатель «не видит» — следим за его родителем
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var t = e.target;
      t.classList.add('is-in');
      if (t._shots) t._shots.forEach(function (x) { x.classList.add('is-in'); });
      if (t._in) t._in();
      io.unobserve(t);
      // карточка (специалист, статья) открывается целиком: фото попало в кадр — подпись и кнопка под ним
      // выходят сразу, а не ждут, пока их дотащат до верхних 95 % окна (иначе внизу висела пустота)
      var card = t.closest('.tm__card, .lf__card') || (t._shots && t._shots[0].closest('.tm__card, .lf__card'));
      if (card) $$('.rv, .rv-shot', card).forEach(function (x) { x.classList.add('is-in'); io.unobserve(x); if (x.parentElement._shots) io.unobserve(x.parentElement); });
    });
  }, { rootMargin: '0px 0px -5% 0px' });
  function watch(el) {
    if (!el.classList.contains('rv-shot')) { io.observe(el); return; }
    var host = el.parentElement;
    (host._shots || (host._shots = [])).push(el);
    io.observe(host);
  }
  $$('.sx .rv, .sx .rv-shot, .sx [data-in]').forEach(watch);

  /* видео-петли играют только на экране; iframe грузятся заранее, но не сразу */
  var vio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; var p = v.play(); if (p) p.catch(function () {}); }
      else v.pause();
    });
  }, { rootMargin: '200px' });
  $$('video[data-autoplay]').forEach(function (v) { vio.observe(v); });
  var fio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.src = e.target.getAttribute('data-src');
      fio.unobserve(e.target);
    });
  }, { rootMargin: '900px' });
  $$('iframe[data-src]').forEach(function (f) { fio.observe(f); });

  /* ═════════ 1. ПЕРВЫЙ ЭКРАН ═════════
     появление по классу .is-in, моноширинные подписи «расшифровываются»;
     по прокрутке (p 0…1): заголовок и карточка уходят, видео темнеет, мысль проявляется по словам */
  var hv = $('#top'), hvVideo = $('#hvVideo'), hvDim = $('#hvDim'), hvBody = $('#hvBody');
  var hvSay = $('#hvSay'), hvSayT = $('#hvSayT');
  var H = { p: -1 };

  // слова мысли — отдельные span, их яркость ведёт прокрутка
  (function () {
    var words = hvSayT.innerHTML.split(/ +/);
    hvSayT.innerHTML = words.map(function (w) { return '<span class="sw">' + w + '</span>'; }).join(' ');
    H.words = $$('.sw', hvSayT);
  })();

  // «расшифровка»: символы перебираются и встают на место слева направо
  var GLYPHS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЭЮЯ0123456789';
  function scramble(el, delay) {
    var nodes = [];
    (function walk(n) { n.childNodes.forEach(function (c) { if (c.nodeType === 3 && c.textContent.trim()) nodes.push(c); else if (c.nodeType === 1) walk(c); }); })(el);
    nodes.forEach(function (node) {
      var fin = node.textContent, len = fin.length, t0 = performance.now() + delay;
      (function tick(now) {
        var k = clamp((now - t0) / 750, 0, 1), fixed = Math.floor(k * len), out = '';
        for (var i = 0; i < len; i++) {
          var ch = fin[i];
          out += (i < fixed || ' \u00a0·—–,/:'.indexOf(ch) >= 0) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        node.textContent = now < t0 ? fin : out;
        if (k < 1) requestAnimationFrame(tick); else node.textContent = fin;
      })(performance.now());
    });
  }

  function hvDraw() {
    var p = H.p;
    var a1 = clamp(p / .3, 0, 1), out = a1 * a1 * (3 - 2 * a1);            // уход первого кадра
    var q = clamp((p - .26) / .5, 0, 1);                                     // проявление мысли
    hvBody.style.transform = 'translate3d(0,' + (-out * vh * .08).toFixed(1) + 'px,0)';
    hvBody.style.opacity = (1 - out * 1.25).toFixed(3);
    hvDim.style.opacity = (out * .34 + q * .1).toFixed(3);                  // темнеет, но не в черноту
    // уход в расфокус: блюр растёт вместе с затемнением, видео чуть крупнее — края размытия за кадром.
    // На телефоне без блюра: фильтр на полноэкранном видео каждый кадр — дорого для мобильной графики
    var u = vw / 1920, bl = MOB ? 0 : (out * 18 + q * 8) * u;
    hvVideo.style.filter = bl > .05 ? 'blur(' + bl.toFixed(2) + 'px)' : '';
    hvVideo.style.setProperty('--vs', (1 + p * .06 + out * .1).toFixed(4));
    var s1 = clamp((p - .18) / .16, 0, 1), s2 = easeOut(clamp((p - .18) / .32, 0, 1));
    hvSay.style.opacity = (s1 * s1 * (3 - 2 * s1)).toFixed(3);
    hvSay.style.transform = 'translateY(calc(-50% + ' + ((1 - s2) * vh * .06).toFixed(1) + 'px))';
    // слова «наводятся на резкость» мягкой волной в три слова: из бледного расфокуса в чёткий белый
    var n = H.words.length, W = 3, lit = q * (n + W);
    for (var i = 0; i < n; i++) {
      var k = clamp((lit - i) / W, 0, 1); k = k * k * (3 - 2 * k);
      var w = H.words[i];
      if (w._k === k) continue;
      w._k = k;
      w.style.setProperty('--o', (.14 + .86 * k).toFixed(3));
      w.style.filter = k < .999 && !MOB ? 'blur(' + ((1 - k) * 3.5 * u).toFixed(2) + 'px)' : '';
    }
  }

  function hvIntro() {
    root.classList.remove('is-loading');
    hv.classList.add('is-in');
    if (!reduced) $$('[data-scramble]', hv).forEach(function (el, i) { scramble(el, 450 + i * 90); });
  }
  new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      $$('video', hv).forEach(function (v) { if (en.isIntersecting) { var pr = v.play(); if (pr) pr.catch(function () {}); } else v.pause(); });
    });
  }).observe(hv);
  if (document.fonts) document.fonts.ready.then(hvIntro); else window.addEventListener('load', hvIntro);
  setTimeout(function () { if (!hv.classList.contains('is-in')) hvIntro(); }, 1500);

  /* ═════════ 5. ПУТЬ ГОСТЯ ═════════
     сцена закреплена, дорожка шагов едет влево вместе с прокруткой; шкала: 51 деление, пройденные — тёмные,
     номер текущего шага подсвечен. Фото внутри рамок чуть смещаются навстречу — глубина. */
  var jrRun = $('#jrRun'), jrTrack = $('#jrTrack'), jrTicks = $('#jrTicks'), jrNums = $$('#jrNums span');
  var jrSteps = $$('.jr__step', jrTrack), J = { dist: 0, lit: -1, cur: -1, top: 0, h: 0, x: -1 };
  var JR_T = 51;
  jrTicks.innerHTML = new Array(JR_T + 1).join('<i></i>');
  var jrTickEls = $$('i', jrTicks);
  /* Дорожка стоит ровно на позиции прокрутки — 1:1, без своей задержки (отдельная пружина делала «ватно»,
     пользователь: «нет чувства скролла»). Позиция дробная (smooth.y): целая scrollY давала ±1px дрожи.
     Рывки убраны в самой плавной прокрутке (smooth.js — пружина вместо скачка скорости на щелчке колеса).
     Шаги, шкала и параллакс кадров считаются от позиции дорожки — без замеров вёрстки в кадре. */
  function jrGeo() {
    // телефон: дорожка — обычная лента со свайпом (scroll-snap), сцена не закреплена; шкала и параллакс — от её прокрутки
    if (MOB) { jrRun.style.height = ''; jrTrack.style.transform = ''; J.x = -1; J.lit = J.cur = -1; jrSyncM(); return; }
    J.dist = Math.max(0, jrTrack.scrollWidth - vw);
    jrRun.style.height = (J.dist + vh * 1.2) + 'px';
    J.top = jrRun.getBoundingClientRect().top + window.scrollY;
    J.h = jrRun.offsetHeight;
    jrSteps.forEach(function (st) { st._x = st.offsetLeft; st._w = st.offsetWidth; });
    J.x = -1; jrDraw();
  }
  function jrTarget() {
    var y = sm && sm.active ? sm.y() : window.scrollY;
    return clamp((y - J.top) / Math.max(1, J.h - vh), 0, 1) * J.dist;
  }
  function jrApply() {
    var x = J.x, p = J.dist ? x / J.dist : 0;
    jrTrack.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)';
    var lit = Math.round(p * (JR_T - 1));
    if (lit !== J.lit) { J.lit = lit; jrTickEls.forEach(function (t, i) { t.classList.toggle('is-on', i <= lit); }); }
    var cur = Math.min(jrNums.length - 1, Math.round(p * (jrNums.length - 1)));
    if (cur !== J.cur) { J.cur = cur; jrNums.forEach(function (n, i) { n.classList.toggle('is-on', i === cur); }); }
    for (var i = 0; i < jrSteps.length; i++) {
      var st = jrSteps[i], l = st._x - x;
      if (l + st._w < -200 || l > vw + 200) continue;
      var lim = st._w * .07;
      st.firstElementChild.style.setProperty('--px', clamp((l + st._w / 2 - vw / 2) * -.04, -lim, lim).toFixed(2) + 'px');
    }
  }
  function jrDraw() {
    if (MOB) return;
    var x = jrTarget();
    if (Math.abs(x - J.x) < .01) return;
    J.x = x; jrApply();
  }
  // телефон: шкала следит за лентой, номер под шкалой — переход к шагу; кадр внутри карточки чуть едет навстречу свайпу
  function jrMark(p) {
    var lit = Math.round(p * (JR_T - 1));
    if (lit !== J.lit) { J.lit = lit; jrTickEls.forEach(function (t, i) { t.classList.toggle('is-on', i <= lit); }); }
    var cur = Math.min(jrNums.length - 1, Math.round(p * (jrNums.length - 1)));
    if (cur !== J.cur) { J.cur = cur; jrNums.forEach(function (n, i) { n.classList.toggle('is-on', i === cur); }); }
  }
  function jrSyncM() {
    if (!MOB) return;
    var x = jrTrack.scrollLeft, max = jrTrack.scrollWidth - jrTrack.clientWidth;
    jrMark(max > 0 ? clamp(x / max, 0, 1) : 0);
    var w = jrTrack.clientWidth;
    for (var i = 0; i < jrSteps.length; i++) {
      var st = jrSteps[i], l = st.offsetLeft - x;
      if (l + st.offsetWidth < -50 || l > w + 50) continue;
      var lim = st.offsetWidth * .07;
      st.firstElementChild.style.setProperty('--px', clamp((l + st.offsetWidth / 2 - w / 2) * -.06, -lim, lim).toFixed(2) + 'px');
    }
  }
  var jrRaf = 0;
  jrTrack.addEventListener('scroll', function () {
    if (!MOB || jrRaf) return;
    jrRaf = requestAnimationFrame(function () { jrRaf = 0; jrSyncM(); });
  }, { passive: true });
  // подсказка «листается»: когда лента впервые на экране, карточки один раз чуть отъезжают влево и возвращаются
  new IntersectionObserver(function (es, o) {
    if (!MOB || !es[0].isIntersecting || reduced) return;
    o.disconnect();
    if (jrTrack.scrollLeft > 4) return;
    setTimeout(function () { jrTrack.classList.add('is-nudge'); setTimeout(function () { jrTrack.classList.remove('is-nudge'); }, 1400); }, 450);
  }, { threshold: .6 }).observe(jrTrack);
  jrNums.forEach(function (n, i) {
    n.addEventListener('click', function () {
      if (!MOB || !jrSteps[i]) return;
      var pad = parseFloat(getComputedStyle(jrTrack).paddingLeft) || 0;
      jrTrack.scrollTo({ left: jrSteps[i].offsetLeft - pad, behavior: reduced ? 'auto' : 'smooth' });
    });
  });

  /* ═════════ параллакс кадров (data-par) ═════════
     кадр сдвигается на долю расстояния от своей середины до середины окна: data-par=".05" — медленнее
     прокрутки, отрицательное — навстречу. В «Главном враче» портрет и кабинет едут с разной скоростью. */
  var pars = $$('[data-par]');
  function parDraw() {
    for (var i = 0; i < pars.length; i++) {
      var el = pars[i], r = el.getBoundingClientRect();
      var off = el._py || 0, top = r.top - off;
      if (top > vh + 200 || top + r.height < -200) continue;
      var py = ((top + r.height / 2) - vh / 2) * -(+el.getAttribute('data-par'));
      py = Math.round(py * 10) / 10;
      if (py !== off) { el._py = py; el.style.transform = 'translate3d(0,' + py + 'px,0)'; }
    }
  }

  /* ═════════ главный врач: кадр и стекло едут медленнее прокрутки (--dy общий для обоих) ═════════ */
  var dk = $('#doctor');
  // стекло компетенций — копия кадра, сдвинутая на положение стекла в сетке блока (sections.css: --pl/--pt/--dw/--dh)
  var dkPanel = $('.dk__panel', dk);
  function dkGeo() {
    if (!dk || !dkPanel) return;
    if (MOB) { ['--pl', '--pt', '--dw', '--dh', '--dz'].forEach(function (p) { dk.style.removeProperty(p); }); return; }
    dk.style.setProperty('--pl', dkPanel.offsetLeft + 'px');
    dk.style.setProperty('--pt', dkPanel.offsetTop + 'px');
    dk.style.setProperty('--dw', dk.clientWidth + 'px');
    dk.style.setProperty('--dh', dk.clientHeight + 'px');
    // кадр 1920×940 вписан cover от верха: высота картинки — большее из высоты блока и ширины × 940/1920, голова доктора — на 20 % её.
    // На узком окне (блок выше пропорции кадра) доктор мельчал, а над головой оставалась пустота: увеличиваем кадр от низа (--dz),
    // по тому, насколько блок выше пропорции кадра, и ещё чуть крупнее с сужением окна; не больше 1,26
    var W = dk.clientWidth, Hb = dk.clientHeight;
    var r = Hb / (W * 940 / 1920), zW = 1 + clamp((1920 - W) / 1920, 0, .5) * .36;
    var z = clamp(Math.max(1 + (r - 1) * 1.1, zW), 1, 1.26);   // 1920 и шире — 1, как в макете
    dk.style.setProperty('--dz', z.toFixed(3));
  }
  if (window.ResizeObserver && dk) new ResizeObserver(function () { dkGeo(); }).observe(dk);
  function dkDraw() {
    var r = dk.getBoundingClientRect();
    if (r.top > vh + 100 || r.bottom < -100) return;
    if (!dk.classList.contains('is-in') && r.top < vh * (MOB ? .8 : .6)) dk.classList.add('is-in');
    if (MOB) { if (dk._dy !== 0) { dk._dy = 0; dk.style.removeProperty('--dy'); } return; }   // портрет на телефоне стоит
    dk._dy = 1;
    var dy = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh)) * r.height * -.018;
    dk.style.setProperty('--dy', dy.toFixed(1) + 'px');
  }

  /* ═════════ общий кадр прокрутки ═════════ */
  var hd = $('#hd');
  var foEl = $('#footer');
  function frame() {
    var y = window.scrollY;
    hd.classList.toggle('is-solid', y > 30);

    // первый экран: сцена по прокрутке; шапка сайта появляется, когда блок ушёл
    var hr = hv.getBoundingClientRect();
    if (hr.bottom > 0) {
      var hp = clamp(-hr.top / (hr.height - vh), 0, 1);
      if (hp !== H.p) { H.p = hp; hvDraw(); }
    }

    var fr = foEl ? foEl.getBoundingClientRect() : null;
    // шапка уезжает, когда подвал до неё дошёл, — иначе закрывает бегущую строку
    hd.classList.toggle('is-hidden', hr.bottom > vh * .35 || (fr && fr.top < hd.offsetHeight));
    if (MOB) mFrame(y, hr);

    // о центре: сцена закреплена, карточки по очереди выплывают, накрытая гаснет
    abDraw();
    // путь гостя: дорожка шагов и шкала
    jrDraw();
    // кадры с разной скоростью
    parDraw();
    dkDraw();
  }
  /* ═════════ телефон: шапка, плашка записи, цвет панели браузера ═════════
     Шапка прячется, пока листают вниз, и возвращается при движении вверх (читать не мешает, меню под рукой).
     Плашка «Записаться» снизу — от «С чем приходят» до «Контактов» (там свои кнопки), пока не открыто окно.
     Цвет строки браузера — тёмный над видео первого экрана, молочный ниже. */
  var mbar = $('#mbar'), cxSec = $('#cases'), ctSec = $('#contacts'), themeMeta = $('#themeColor');
  var M = { y: window.scrollY, acc: 0, up: false, bar: null, theme: '' };
  function mFrame(y, hr) {
    var dy = y - M.y; M.y = y;
    if (dy && (dy > 0) !== (M.acc > 0)) M.acc = 0;
    M.acc += dy;
    var up = M.up;
    if (M.acc > 14 && y > vh * .5) up = true;
    else if (M.acc < -14 || y < 10) up = false;
    if (up !== M.up) { M.up = up; hd.classList.toggle('is-up', up); }
    var open = typeof stack !== 'undefined' && stack.length > 0;
    var bar = !open && cxSec.getBoundingClientRect().top < vh * .55 && ctSec.getBoundingClientRect().top > vh * .9;
    if (bar !== M.bar) { M.bar = bar; mbar.classList.toggle('is-on', bar); }
    var th = hr.bottom > 64 ? '#16100c' : '#F9F5F2';
    if (th !== M.theme && themeMeta) { M.theme = th; themeMeta.setAttribute('content', th); }
  }

  var sm = window.smooth;
  if (sm && sm.active) sm.onFrame(frame);
  var ticking = false;
  /* прокрутка мимо плавной (ползунок, поиск, переход по якорю) — тоже пересчитываем */
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; frame(); });
  }, { passive: true });

  function layout() {
    vw = innerWidth; vh = innerHeight;
    H.p = -1;
    jrGeo();
    cxGeo();
    abClip();
    dkGeo();
    if (MOB) { $$('video[data-src-t]').forEach(pickSrc); abGeoM(); }
    frame();
  }
  // на телефоне resize прилетает и от строки браузера (меняется только высота) — ширина та же, раскладку не трогаем
  var lastW = innerWidth;
  window.addEventListener('resize', function () {
    if (MOB && innerWidth === lastW) { vh = innerHeight; abGeoM(); frame(); return; }
    lastW = innerWidth;
    layout();
  });
  // переход телефон ⇄ ПК (поворот планшета, сужение окна): источники роликов, карта, сброс того, что писал другой режим
  function onMode() {
    MOB = mqM.matches;
    root.classList.toggle('is-mob', MOB);
    $$('video[data-src-m]').forEach(pickSrc);
    abCards.forEach(function (c) { ['--ty', '--s', '--o', '--fx', '--fy', '--fw', '--fh'].forEach(function (p) { c.style.removeProperty(p); }); c.style.transform = ''; c.style.visibility = ''; c._ty = 0; c._sc = 1; c._fx = null; });
    abKey = ''; abS = -1;
    jrSteps.forEach(function (st) { st.firstElementChild.style.removeProperty('--px'); });
    if (!MOB) {
      hd.classList.remove('is-up'); M.up = false; mbar.classList.remove('is-on'); M.bar = null;
      cxRows.forEach(function (r) { r.classList.remove('is-open'); r.setAttribute('aria-expanded', 'false'); });
      if (stack.length && stack[stack.length - 1] === mm) closeM(mm);
    }
    ctInit();
    layout();
  }
  if (mqM.addEventListener) mqM.addEventListener('change', onMode); else if (mqM.addListener) mqM.addListener(onMode);
  layout();
  requestAnimationFrame(function () { hd.classList.add('is-ready'); });
  window.addEventListener('load', layout);
  if (document.fonts) document.fonts.ready.then(layout);

  /* ═════════ 3. С ЧЕМ ПРИХОДЯТ — ТАБЛИЦА СИВЦЕВА ═════════
     строки уменьшаются, как в таблице; наведение (с короткой задержкой), клик и фокус выбирают случай.
     В каждом кадре — резкое фото и запечённая размытая копия под стеклом; прямоугольник стекла
     (--gt/--gr/--gb/--gl) считается от .cx__glass, чтобы размытие лежало ровно под подложкой. */
  var cx = $('#cases'), cxChart = $('#cxChart'), cxPhoto = $('#cxPhoto'), cxGlass = $('#cxGlass');
  var cases = SITE.cases || [];
  var FS = [36, 33.57, 31.65, 28.78, 25.9, 23.98, 22.06, 22.06, 20, 17];  // кегль строки, px кадра 1920 (Figma)
  var CS = [18, 17, 16, 15, 14, 14, 13, 12, 11, 10];                    // кегль кода (Ш Б, М Н К…)
  var FSM = [27, 25.5, 24, 22.5, 21.5, 20.5, 19.5, 19, 18, 17];         // то же на телефоне, px кадра 390 — таблица так же «уменьшается»
  var CSM = [13, 12.5, 12, 11.5, 11, 11, 10.5, 10.5, 10, 10];
  var ARR_UP = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.25 12.75 12.75 5.25M5.25 5.25h7.5v7.5"/></svg>';
  var C = { cur: -1, z: 1 };
  var pad2 = function (v) { return (v < 10 ? '0' : '') + v; };
  var cxRows = [], cxShots = [];
  cases.forEach(function (c, i) {
    var li = document.createElement('li');
    li.className = 'cx__row';
    li.tabIndex = 0;
    li.style.setProperty('--i', i);
    li.style.setProperty('--fs', 'calc(' + (FS[i] || 17) + ' * var(--u))');
    li.style.setProperty('--cs', 'calc(' + (CS[i] || 10) + ' * var(--u))');
    // на телефоне строка раскрывается на месте: кадр (грузится при первом раскрытии), «как бывает», «что делаем», запись
    li.style.setProperty('--fm', FSM[i] || 17);
    li.style.setProperty('--cm', CSM[i] || 10);
    li.setAttribute('aria-expanded', 'false');
    // короткие слова («и», «у», «не») не остаются в конце строки — на телефоне фразы переносятся
    var nb = function (t) { return t.replace(/(^|[\s«(—])([а-яёА-ЯЁ]{1,2}) /g, function (m, a, w) { return a + w + ' '; }).replace(/ —/g, ' —'); };
    // на телефоне — переносы строк из макета (c.m, «|»); на ПК строка целиком
    var sp = SITE.spec && SITE.spec[c.who];   // к кому ведёт запись из этой строки (пусто — выбор специалиста)
    var tNb = c.m ? c.m.split('|').map(nb).join(' <br class="m-only">') : nb(c.t);
    li.innerHTML = '<span class="cx__code">' + c.code + '</span><span class="cx__t">' + tNb + '</span><span class="cx__pm" aria-hidden="true"></span>' +
      '<div class="cx__more"><div><div class="cx__mi">' +
        '<figure class="cx__mimg"><img data-src="' + c.img + '" alt="" decoding="async"><span class="cx__mmeta"><b>' + pad2(i + 1) + ' / ' + pad2(cases.length) + '</b>' + c.code + ' · V = ' + c.v + '</span></figure>' +
        '<div class="cx__mtx"><span class="cx__k">Как это бывает</span><p>' + c.how + '</p></div>' +
        '<div class="cx__mtx"><span class="cx__k">Что мы делаем</span><p>' + c.what + '</p></div>' +
        '<a class="kbtn kbtn--wide cx__mbtn" href="#book" data-book' + (sp ? ' data-who="' + c.who + '"' : '') + '><span>' + (sp && sp.dative ? 'Записаться к&nbsp;' + sp.dative : 'Записаться на&nbsp;подбор') + '</span><i>' + ARR_UP + '</i></a>' +
      '</div></div></div>';
    cxChart.appendChild(li);
    cxRows.push(li);
    var shot = document.createElement('div');
    shot.className = 'cx__shot';
    // кадры ПК — lazy: на телефоне блок кадра скрыт, и они не качаются вовсе
    shot.innerHTML = '<img class="cx__img" src="' + c.img + '" alt="" loading="lazy" decoding="async">' +
      '<div class="cx__frost"><img src="' + (c.blur || c.img.replace('.webp', '-blur.webp')) + '" alt="" loading="lazy" decoding="async"></div>';
    cxPhoto.insertBefore(shot, cxGlass);
    cxShots.push(shot);
  });
  function cxClip() {
    if (!cxGlass) return;
    var W = cxPhoto.clientWidth, H = cxPhoto.clientHeight;
    var l = cxGlass.offsetLeft, t = cxGlass.offsetTop, w = cxGlass.offsetWidth, h = cxGlass.offsetHeight;
    cxPhoto.style.setProperty('--gt', t + 'px');
    cxPhoto.style.setProperty('--gl', l + 'px');
    cxPhoto.style.setProperty('--gr', (W - l - w) + 'px');
    cxPhoto.style.setProperty('--gb', (H - t - h) + 'px');
    cxPhoto.style.setProperty('--gr-rad', getComputedStyle(cxGlass).borderTopLeftRadius);
  }
  var cxSwapT;
  function cxShow(i, instant) {
    if (i === C.cur || !cases[i]) return;
    C.cur = i;
    var c = cases[i];
    cxRows.forEach(function (r, k) { r.classList.toggle('is-on', k === i); });
    // z-index не копится: новый кадр — 3, уходящий — 2, остальные — 1 (стекло лежит выше, на 20)
    var prev = C.prev != null ? C.prev : -1;
    cxShots.forEach(function (x, k) { x.style.zIndex = k === i ? 3 : k === prev ? 2 : 1; });
    C.prev = i;
    cxShots.forEach(function (x, k) { x.classList.toggle('is-on', k === i); });
    $('#cxN').textContent = pad2(i + 1) + ' / ' + pad2(cases.length);
    $('#cxV').innerHTML = c.code + ' · V = ' + c.v;
    var fill = function () {
      $('#cxH').innerHTML = c.t;
      $('#cxHow').innerHTML = c.how;
      $('#cxDo').innerHTML = c.what;
      $('#cxBtn').setAttribute('data-who', SITE.spec && SITE.spec[c.who] ? c.who : '');
      cxGlass.classList.remove('is-swap');
      cxClip();
    };
    clearTimeout(cxSwapT);
    if (instant) { fill(); return; }
    cxGlass.classList.add('is-swap');
    cxSwapT = setTimeout(fill, 230);
  }
  var cxHoverT;
  function cxLoadM(row) {
    var img = $('.cx__mimg img', row);
    if (!img || img.getAttribute('src')) return;
    img.onload = function () { img.classList.add('is-ld'); };
    img.src = img.getAttribute('data-src');
  }
  function cxToggleM(i) {
    accToggle(cxRows, cxRows[i], function (row, open) {
      row.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) cxLoadM(row);
    });
  }
  cxRows.forEach(function (r, i) {
    r.addEventListener('mouseenter', function () { if (MOB) return; clearTimeout(cxHoverT); cxHoverT = setTimeout(function () { cxShow(i); }, 80); });
    r.addEventListener('mouseleave', function () { clearTimeout(cxHoverT); });
    r.addEventListener('click', function (e) {
      if (!MOB) { cxShow(i); return; }
      if (e.target.closest('.cx__more')) return;   // внутри раскрытого — свои кнопки
      cxToggleM(i);
    });
    // кадр начинает грузиться уже от касания — к раскрытию он, как правило, готов
    r.addEventListener('touchstart', function () { if (MOB) cxLoadM(r); }, { passive: true });
    r.addEventListener('focus', function () { if (!MOB) cxShow(i); });
    r.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); (cxRows[i + 1] || r).focus(); }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); (cxRows[i - 1] || r).focus(); }
      if (MOB && (ev.key === 'Enter' || ev.key === ' ') && ev.target === r) { ev.preventDefault(); cxToggleM(i); }
    });
  });
  if (cases.length) cxShow(0, true);
  // появление — когда блок заметно на экране, а не когда показался краешек
  new IntersectionObserver(function (es, o) {
    es.forEach(function (en) {
      if (en.intersectionRatio < .3) return;
      cx.classList.add('is-in');
      setTimeout(function () { cx.classList.add('is-done'); }, 2200);
      o.disconnect();
    });
  }, { threshold: [0, .3, .5] }).observe(cx);
  function cxGeo() { cxClip(); }
  // высота стекла меняется с длиной текста — размытие под ним пересчитываем сразу, иначе оно торчит рамкой
  if (window.ResizeObserver) new ResizeObserver(cxClip).observe(cxGlass);
  cxClip();
  window.addEventListener('load', cxClip);
  if (document.fonts) document.fonts.ready.then(cxClip);

  /* ═════════ 2. О ЦЕНТРЕ ═════════
     сцена закреплена, как на clingr.me: блок встаёт на экран без карточек, дальше каждая карточка
     выплывает снизу строго вместе со скроллом (1:1) на своё место, и следующая наезжает на неё.
     Накрываемая карточка, пока следующая едет, плавно гаснет (с 30 % пути), чуть уменьшается
     и отходит вверх — к моменту, когда новая встала, старой уже не видно.
     q[i] — сколько прошла i-я карточка (0…1), пути идут один за другим без пауз.
     Копия фона в стекле пересчитывается навстречу сдвигу и масштабу карточки.
     Видео играет, только пока блок на экране. */
  var ab = $('#about'), abCards = ab ? $$('.ab__card', ab) : [], abVideo = $('#abVideo');
  var AB_X = 1218, AB_T = 300, AB_W = 597, AB_LIFT = 34, AB_SCALE = .06;
  var abKey = '';
  var AB_DAMP = 5, abS = -1, abGoal = 0, abLast = 0, abRaf = 0;
  var smooth01 = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function abClip() { abKey = ''; abFit(); }
  // ПК: длинный текст «О центре» не должен заходить на «Следуйте за белым кроликом» — в низком окне кегль ужимается (--abk, не мельче 10.5px)
  function abFit() {
    var lead = ab && $('.ab__lead', ab), fol = ab && $('.ab__follow', ab);
    if (!lead || !fol) return;
    lead.style.removeProperty('--abk');
    if (MOB) return;
    var u = Math.min(innerWidth / 1920, innerHeight / 1035), k = 1;
    var fs0 = parseFloat(getComputedStyle($('p', lead)).fontSize) || 15;
    for (var n = 0; n < 5; n++) {
      var avail = fol.getBoundingClientRect().top - lead.getBoundingClientRect().top - 40 * u, h = lead.offsetHeight;
      if (h <= avail || fs0 * k <= 10.5) break;
      k = Math.max(10.5 / fs0, k * Math.min(.98, avail / h));
      lead.style.setProperty('--abk', k.toFixed(3));
    }
  }
  /* телефон и планшет (макет 93:14): сцена с карточкой 01 закреплена низом у низа экрана (.ab__pin sticky в .ab__run),
     прокрутка 1:1 выносит снизу 02, затем 03 — каждая наезжает на предыдущую; накрытая чуть уменьшается и отходит вверх
     (не гаснет — 2026-10-18, лаги на телефоне). Стекло стоит вместе с карточкой. В низком окне (телефон боком) .ab__pin не липнет — карточки столбиком. */
  var abRun = $('#abRun'), abPin = $('#abPin'), AM = { on: false, top: 0, path: 1 };
  function abGeoM() {
    if (!MOB || !abPin) return;
    var cs = getComputedStyle(abPin);
    AM.on = cs.position === 'sticky';
    AM.top = parseFloat(cs.top) || 0;
    AM.path = abCards[0] ? abCards[0].offsetHeight + 24 * fpx() : 1;
    if (!AM.on) abCards.forEach(function (c) { c.style.transform = ''; c.style.visibility = ''; });
    abKey = '';
  }
  function abDrawM() {
    var r = ab.getBoundingClientRect();
    if (r.top > vh * 1.5 || r.bottom < -vh * .5) return;
    if (!ab.classList.contains('is-in') && r.top < vh * .8) ab.classList.add('is-in');
    if (!AM.on) return;
    var s = AM.top - abRun.getBoundingClientRect().top;        // сколько прокручено с момента закрепления
    var key = Math.round(s) + '|' + vw + '|' + vh;
    if (key === abKey) return;
    abKey = key;
    var path = AM.path, f = fpx();
    var q = abCards.map(function (c, i) { return i ? clamp((s - (i - 1) * path) / path, 0, 1) : 1; });
    // только transform прямо в style: без переменных (они наследуются — пересчёт стиля всего содержимого) и без гашения
    // накрытой — она и так закрыта непрозрачной следующей; стекло стоит на месте относительно карточки, не перерисовывается
    for (var i = 0; i < abCards.length; i++) {
      var g = i + 1 < q.length ? smooth01(.3, 1, q[i + 1]) : 0;   // насколько накрыта следующей
      var ty = (1 - q[i]) * (path + 40) - 26 * f * g;
      var c = abCards[i].style;
      c.transform = 'translate3d(0,' + ty.toFixed(1) + 'px,0) scale(' + (1 - AB_SCALE * g).toFixed(4) + ')';
      var hid = g > .999 ? 'hidden' : '';
      if (c.visibility !== hid) c.visibility = hid;
    }
  }
  function abDraw() {
    if (!ab) return;
    if (MOB) { abDrawM(); return; }
    var r = ab.getBoundingClientRect();
    if (r.top > vh * 1.5 || r.bottom < -vh * .5) return;
    if (r.top < vh * .55) ab.classList.add('is-in');
    var sT = reduced ? 1e9 : Math.max(0, -r.top);  // сколько прокручено с момента закрепления
    // как на millident.ru: прогресс карточек догоняет прокрутку с затуханием 5/с — щелчок колеса
    // не ставит карточку сразу, она доплывает с мягким хвостом. Далёкий скачок (якорь, ползунок) — сразу.
    if (abS < 0 || reduced || Math.abs(sT - abS) > vh * 2) abS = sT;
    abGoal = sT;
    if (Math.abs(sT - abS) > .2 && !abRaf) { abLast = performance.now(); abRaf = requestAnimationFrame(abTick); }
    abRender(abS);
  }
  function abTick(now) {
    var dt = Math.min((now - abLast) / 1000, .05);
    abLast = now;
    abS += (abGoal - abS) * (1 - Math.exp(-AB_DAMP * dt));
    if (Math.abs(abGoal - abS) < .2) abS = abGoal;
    abRaf = abS === abGoal ? 0 : requestAnimationFrame(abTick);
    abRender(abS);
  }
  function abRender(s) {
    var u = Math.min(vw / 1920, vh / 1035);
    var lift = (vh - 1035 * u) / 2;               // текст и карточки подняты к центру окна (about.css, --lift)
    var path = (1035 - AB_T) * u + lift + 40;      // от нижнего края сцены до места
    var key = Math.round(s * 4) + '|' + vw + '|' + vh;
    if (key === abKey) return;
    abKey = key;
    var q = abCards.map(function (c, i) { return clamp((s - i * path) / path, 0, 1); });
    for (var i = 0; i < abCards.length; i++) {
      var g = i + 1 < q.length ? smooth01(.3, 1, q[i + 1]) : 0;   // насколько ушла (накрыта следующей)
      var sc = 1 - AB_SCALE * g;
      var ty = (1 - q[i]) * path - AB_LIFT * u * g;
      var c = abCards[i].style;
      c.setProperty('--ty', ty.toFixed(1) + 'px');
      c.setProperty('--s', sc.toFixed(4));
      c.setProperty('--o', (1 - g).toFixed(3));
      c.visibility = g > .999 ? 'hidden' : '';
      // копия фона: в координатах карточки до масштаба (origin — середина верхнего края)
      // x карточки — из вёрстки: она стоит на поле сетки страницы, а не на 1218 кадра
      var vx = abCards[i].offsetLeft + AB_W * u * (1 - sc) / 2, vy = AB_T * u - lift + ty;
      c.setProperty('--fx', (-vx / sc).toFixed(1) + 'px');
      c.setProperty('--fy', (-vy / sc).toFixed(1) + 'px');
      c.setProperty('--fw', (1920 * u / sc).toFixed(1) + 'px');
      c.setProperty('--fh', (1235 * u / sc).toFixed(1) + 'px');
    }
  }
  if (ab) new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!abVideo) return;
      if (en.isIntersecting) { var pr = abVideo.play(); if (pr) pr.catch(function () {}); } else abVideo.pause();
    });
  }).observe(ab);
  abGeoM();
  abFit();
  if (document.fonts) document.fonts.ready.then(abFit);
  abDraw();

  /* ═════════ 9. ЖИЗНЬ ЦЕНТРА ═════════
     карточки из news.js: кадр, подпись «рубрика · дата» с цветной меткой, заголовок, текст и «Читать статью».
     Кадр, заголовок и ссылка открывают статью поверх страницы (ниже, «статья») */
  var NEWS_ITEMS = [];
  var TAG = { event: 'Мероприятие', frames: 'Новые оправы', doctor: 'Доктор Кольцов' };
  var DOT = { event: '#6E92C2', frames: '#D3B284', doctor: '#73562C' };
  var ARR = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.25 12.75 12.75 5.25M5.25 5.25h7.5v7.5"/></svg>';
  var ARR_R = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h12M10.5 4.5 15 9l-4.5 4.5"/></svg>';
  var DAY = 864e5;
  var isSoon = function (n) { return n.tag === 'event' && n.eventDate && new Date(n.eventDate).getTime() + DAY > Date.now(); };
  (function () {
    var N = SITE.news, sec = $('#life'), grid = $('#lifeGrid');
    if (!N || !N.show || !sec) return;
    var now = Date.now();
    var items = (N.items || []).filter(function (n) { return !n.hidden; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (!items.length) return;
    if (N.hideAfterDays && now - new Date(items[0].date).getTime() > N.hideAfterDays * DAY) return;
    NEWS_ITEMS = items;
    grid.innerHTML = items.slice(0, 3).map(function (n, i) {
      var when = isSoon(n) && n.when ? ' · <em>' + n.when + '</em>' : '';
      return '<article class="lf__card" style="--d:' + (i * .08) + 's">' +
        '<button class="lf__m rv-shot" type="button" data-news-open="' + n.id + '" aria-label="Читать: ' + n.title + '"><img src="' + n.img + '" alt="" loading="lazy" decoding="async">' +
        '<span class="tm__more" aria-hidden="true"><span>Читать</span><i></i></span></button>' +
        '<p class="lf__meta rv" style="--c:' + DOT[n.tag] + '"><i></i>' + TAG[n.tag] + when + '</p>' +
        '<h3 class="rv"><button type="button" data-news-open="' + n.id + '">' + n.title + '</button></h3><p class="lf__txt rv">' + n.text + '</p>' +
        '<button class="lf__a rv" type="button" data-news-open="' + n.id + '">' + (isSoon(n) && n.cta ? n.cta : 'Читать статью') + ARR + '</button></article>';
    }).join('');
    sec.hidden = false;
    $$('.rv, .rv-shot', grid).forEach(watch);
  })();
  // пункт «Жизнь центра» в меню телефона — только когда блок показан
  (function () { var a = $('[data-life]'), s = $('#life'); if (a && s && s.hidden) a.hidden = true; })();

  /* ═════════ 10. ВОПРОСЫ: открыт один ответ за раз, высота раскрывается плавно (sections.css) ═════════ */
  $$('.fq__item').forEach(function (it, i, all) {
    var q = $('.fq__q', it);
    q.addEventListener('click', function () {
      if (MOB) { accToggle(all, it, function (x, open) { $('.fq__q', x).setAttribute('aria-expanded', open ? 'true' : 'false'); }); return; }
      var on = !it.classList.contains('is-open');
      all.forEach(function (o) { o.classList.remove('is-open'); $('.fq__q', o).setAttribute('aria-expanded', 'false'); });
      if (on) { it.classList.add('is-open'); q.setAttribute('aria-expanded', 'true'); }
    });
  });

  /* ═════════ окна поверх страницы: запись, специалист, статья, плеер ═════════
     Окна складываются стопкой: из статьи или панели врача можно открыть запись, Esc и крестик закрывают верхнее.
     Пока открыто хоть одно — страница стоит (html.is-locked, колесо листает только окно). */
  var sheet = $('#book'), player = $('#player'), pv = $('#playerV'), dp = $('#dp'), ar = $('#ar'), mm = $('#mm');
  var stack = [];
  function lock(on) { root.classList.toggle('is-locked', on); }
  /* телефон: окно — отдельный шаг истории, системная «назад» закрывает его, а не уводит со страницы.
     Пока открыта стопка окон, в истории одна запись; закрыли крестиком — запись снимаем сами (history.back). */
  var HIST = { skip: 0 };
  var useHist = function () { return MOB && !!history.pushState; };
  if (MOB && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
  function openM(m, url) {
    stack = stack.filter(function (x) { return x !== m; });
    stack.push(m);
    m.classList.add('is-open'); m.setAttribute('aria-hidden', 'false'); lock(true);
    if (m === mm) $$('[data-menu]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
    if (MOB && M.bar) { M.bar = false; mbar.classList.remove('is-on'); }   // плашка записи не висит под окном
    if (useHist() && !(history.state && history.state.km)) history.pushState({ km: 1 }, '', url || location.href);
    else if (url) history.replaceState(history.state, '', url);
    setTimeout(function () { var x = $('[data-close]:not([class$="__bg"])', m); if (x) x.focus({ preventScroll: true }); }, 60);
  }
  function closeM(m, how) {
    if (!m || !m.classList.contains('is-open')) return;
    stack = stack.filter(function (x) { return x !== m; });
    m.classList.remove('is-open'); m.setAttribute('aria-hidden', 'true');
    if (m === mm) $$('[data-menu]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    if (m === player) { pv.pause(); setTimeout(function () { if (!player.classList.contains('is-open')) { pv.removeAttribute('src'); pv.load(); } }, 800); }
    var hist = useHist() && history.state && history.state.km;
    if (m === ar && /^#news-/.test(location.hash) && !hist) history.replaceState(history.state, '', location.pathname + location.search);
    if (!stack.length) lock(false);
    if (hist && !stack.length && how !== 'pop') { HIST.skip++; history.back(); }
    if (MOB && !stack.length) frame();
  }
  window.addEventListener('popstate', function () {
    var clean = function () { if (!ar.classList.contains('is-open') && /^#news-/.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search); };
    if (HIST.skip) { HIST.skip--; clean(); return; }
    if (!stack.length) return;
    closeM(stack[stack.length - 1], 'pop');
    clean();
    if (stack.length && useHist()) history.pushState({ km: 1 }, '', location.href);
  });
  $$('[data-close]').forEach(function (c) {
    c.addEventListener('click', function () { closeM(c.closest('.sheet,.player,.dp,.ar,.mm')); });
  });
  /* меню телефона: разделы, телефон, мессенджеры, запись; пункт меню закрывает его и ведёт к разделу (якоря — ниже) */
  $$('[data-menu]').forEach(function (b) { b.addEventListener('click', function () { openM(mm); }); });
  $$('.mm__nav a, .mm__logo', mm).forEach(function (a) { a.addEventListener('click', function () { closeM(mm); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && stack.length) closeM(stack[stack.length - 1]);
    if (stack[stack.length - 1] === dp && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) dpStep(e.key === 'ArrowRight' ? 1 : -1);
  });

  /* ── специалисты: одни данные для панели «подробнее» и для записи — SITE.spec, порядок SITE.order (меняются в админке).
        Пункты опыта с «__» (заглушки) выводятся серым курсивом ── */
  var SPEC = SITE.spec || {};
  var SP = (SITE.order || []).filter(function (k) { return SPEC[k]; });

  /* ── специалист подробнее: панель справа, листается стрелками (и ← → на клавиатуре) ── */
  var dpAt = 0, dpScroll = $('#dpScroll'), dpBody = $('#dpBody'), dpImg = $('#dpImg');
  function dpFill() {
    var k = SP[dpAt], s = SPEC[k], h = '';
    dpImg.src = s.img; dpImg.alt = s.name;
    $('#dpN').textContent = pad2(dpAt + 1) + ' / ' + pad2(SP.length);
    h += '<p class="sheet__label"><i></i>' + s.tag + '</p><h3 class="dp__name" id="dpName">' + s.name + '</h3>' + (s.role !== s.tag ? '<p class="dp__role">' + s.role + '</p>' : '');  // у оптометристов должность = подпись над именем — не дублируем
    h += '<p class="dp__lead">' + s.lead + '</p>';
    if (s.facts) h += '<ul class="dp__facts">' + s.facts.map(function (f) { return '<li><b>' + f[0] + (f[1] ? '<small>' + f[1] + '</small>' : '') + '</b><span>' + f[2] + '</span></li>'; }).join('') + '</ul>';
    // «С чем приходят» в панели убран по просьбе пользователя (2026-10-17); данные s.cases оставлены
    h += '<div class="dp__sec"><p class="dp__k"><i></i>Что входит в&nbsp;приём</p><ul class="dp__list">' + s.visit.map(function (c, i) { return '<li><em>' + pad2(i + 1) + '</em><div>' + c + '</div></li>'; }).join('') + '</ul></div>';
    h += '<div class="dp__sec"><p class="dp__k"><i></i>Образование и&nbsp;опыт</p><ul class="dp__list dp__cv">' + s.cv.map(function (c) { return '<li><em>' + c[0] + '</em><div' + (c[2] ? ' class="dp__ph"' : '') + '>' + c[1] + '</div></li>'; }).join('') + '</ul></div>';
    dpBody.innerHTML = h;
    $('#dpSvc').innerHTML = s.svc;
    $('#dpPrice').innerHTML = s.priceText;
    $('#dpBook').setAttribute('aria-label', 'Записаться: ' + s.name.replace(/&nbsp;/g, ' '));
  }
  var dpT;
  function dpStep(d) {
    clearTimeout(dpT);
    dp.style.setProperty('--sw', d);
    dp.classList.add('is-swap');
    dpT = setTimeout(function () {
      dpAt = (dpAt + d + SP.length) % SP.length;
      dpFill();
      dpScroll.scrollTop = 0;
      dp.style.setProperty('--sw', -d);
      void dpBody.offsetWidth;
      dp.classList.remove('is-swap');
    }, 260);
  }
  function dpOpen(k) { dpAt = Math.max(0, SP.indexOf(k)); dpFill(); dpScroll.scrollTop = 0; openM(dp); }
  $$('[data-dp-step]').forEach(function (b) { b.addEventListener('click', function () { dpStep(+b.getAttribute('data-dp-step')); }); });
  $$('.tm__card[data-sp]').forEach(function (c) {
    var k = c.getAttribute('data-sp');
    $$('[data-sp-open], .tm__name', c).forEach(function (t) { t.addEventListener('click', function () { dpOpen(k); }); });
  });
  $('#dpBook').addEventListener('click', function () { var k = SP[dpAt]; closeM(dp); openSheet(k); });

  /* ── запись: специалист → контакты → заявка принята. Дату и время на сайте не выбирают (просьба пользователя, 2026-10-17):
        администратор перезванивает и подбирает время сам. В рабочей версии заявка уходит в YClients / CRM центра ── */
  var bk = $('.bk', sheet), B = { who: null };
  var MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  // кто, услуга, стоимость, длительность, адрес — сводка на шаге контактов и «билет» в конце
  function bkSum(chg) {
    var s = SPEC[B.who];
    return '<div class="bk__row"><img src="' + s.thumb + '" alt=""><span class="bk__who"><b>' + s.name + '</b>' + s.svc + '</span>' + (chg ? '<button class="bk__chg" type="button" data-to="who">Изменить</button>' : '') + '</div>' +
      '<div class="bk__cells bk__cells--2"><div><small>Стоимость</small><b>' + s.priceText + '</b></div><div><small>Длительность</small><b>' + (SITE.dur || '') + '</b></div></div>' +
      '<div class="bk__addr"><small>Адрес</small>' + (SITE.addr || '') + '</div>';
  }
  var STEPS = ['who', 'form', 'done'];
  function bkGo(step, back) {
    var cur = bk.getAttribute('data-step');
    if (back == null) back = STEPS.indexOf(step) < STEPS.indexOf(cur);
    bk.setAttribute('data-step', step);
    $$('.bk__v', bk).forEach(function (v) {
      var on = v.getAttribute('data-v') === step;
      v.hidden = !on;
      if (on) { v.classList.toggle('is-back', !!back); v.style.animation = 'none'; void v.offsetWidth; v.style.animation = ''; }
    });
    var si = STEPS.indexOf(step);
    $$('.bk__steps li', bk).forEach(function (li, i) { li.classList.toggle('is-on', i === si); li.classList.toggle('is-past', i < si); });
    bk.scrollTop = 0;
    if (step === 'who') $$('.who', bk).forEach(function (w) { w.classList.toggle('is-pick', w.getAttribute('data-pick') === B.who); });
    if (step === 'form') $('[data-bk-sum]', bk).innerHTML = bkSum(true);
    if (step === 'done') {
      $('#bkWhen').textContent = B.name;
      $('[data-bk-ticket]', bk).innerHTML = bkSum(false);
      $$('[data-bk-tel]', bk).forEach(function (t) { t.textContent = B.tel; });
    }
  }
  function openSheet(who) {
    $$('img[data-src]', bk).forEach(function (i) { if (!i.getAttribute('src')) i.src = i.getAttribute('data-src'); });   // миниатюры — при первом открытии
    var fresh = bk.getAttribute('data-step') === 'done' || !bk.hasAttribute('data-step');
    if (fresh) { B.who = null; $('#bkForm').reset(); }
    if (who && SPEC[who]) { B.who = who; bkGo('form', false); }
    else bkGo(fresh || !B.who ? 'who' : bk.getAttribute('data-step'), false);
    openM(sheet);
  }
  $$('[data-book]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      openSheet(b.getAttribute('data-who'));
      if (b.closest('.mm')) closeM(mm);   // из меню: запись встаёт на его место (запись в истории та же)
    });
  });
  bk.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t || !bk.contains(t)) return;
    if (t.hasAttribute('data-pick')) { B.who = t.getAttribute('data-pick'); bkGo('form'); return; }
    if (t.hasAttribute('data-to') || t.hasAttribute('data-bk-back')) bkGo('who');
  });
  // телефон набирается в виде +7 (999) 123-45-67; восьмёрка в начале — тоже российский номер
  var fTel = $('#bkForm [name=tel]');
  function telFmt(v) {
    var d = v.replace(/\D/g, '');
    if (d[0] === '8') d = '7' + d.slice(1);         // 8 921… → +7 921…
    else if (d && d[0] !== '7') d = '7' + d;         // 921… → +7 921…
    d = d.slice(0, 11);
    var o = '+7';
    if (d.length > 1) o += ' (' + d.slice(1, 4);
    if (d.length >= 4) o += ')';
    if (d.length > 4) o += ' ' + d.slice(4, 7);
    if (d.length > 7) o += '-' + d.slice(7, 9);
    if (d.length > 9) o += '-' + d.slice(9, 11);
    return d ? o : '';
  }
  fTel.addEventListener('input', function () { fTel.value = telFmt(fTel.value); });
  $('#bkForm').addEventListener('input', function (e) { var f = e.target.closest('.bk__f,.bk__ok'); if (f) f.classList.remove('is-bad'); });
  $('#bkForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, ok = true;
    var bad = function (el) { var w = el.closest('.bk__f,.bk__ok'); w.classList.remove('is-bad'); void w.offsetWidth; w.classList.add('is-bad'); ok = false; };
    if (f.name.value.trim().length < 2) bad(f.name);
    if (fTel.value.replace(/\D/g, '').length !== 11) bad(fTel);
    if (!f.ok.checked) bad(f.ok);
    if (!ok || f.classList.contains('is-busy')) return;
    B.name = f.name.value.trim(); B.tel = fTel.value;
    var err = $('[data-bk-err]', f), plain = function (x) { var d = document.createElement('div'); d.innerHTML = x || ''; return d.textContent; };
    if (err) err.hidden = true;
    f.classList.add('is-busy');
    sendLead({ kind: 'book', who: B.who || '', whoName: B.who && SPEC[B.who] ? plain(SPEC[B.who].name) : '', name: B.name, tel: B.tel,
      note: f.note.value.trim(), hp: f.company ? f.company.value : '' }).then(function (sent) {
      f.classList.remove('is-busy');
      if (sent) bkGo('done'); else if (err) err.hidden = false;
    });
  });

  /* ── заявка уходит в send.php: сохраняется в админке («Заявки») и приходит уведомлением.
        Где сервера заявок нет (локальный просмотр, превью на GitHub Pages — send.php отвечает 404) — показываем «принято», как в прототипе ── */
  function sendLead(data) {
    if (!SITE.send || !window.fetch) return Promise.resolve(true);
    data.page = location.href.split('#')[0];
    return fetch(SITE.send, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(function (r) {
      if (r.status === 404 || r.status === 405 || r.status === 501) return true;
      return r.json().then(function (j) { return !!(j && j.ok); }, function () { return false; });
    }, function () { return false; });
  }

  /* ── статья «Жизнь центра»: лист снизу поверх страницы, адрес #news-<id>, «Читайте также» листает статьи на месте ── */
  var arIn = $('#arIn'), arSheet = $('#arSheet');
  var dateRu = function (s) { var d = new Date(s); return d.getDate() + '&nbsp;' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
  function arHtml(n) {
    var h = '<header class="ar__head"><div><p class="ar__meta" style="--c:' + DOT[n.tag] + '"><span><i></i><b>' + TAG[n.tag] + '</b></span><span>' + dateRu(n.date) + '</span>' + (n.read ? '<span>' + n.read + '&nbsp;мин чтения</span>' : '') + '</p>' +
      '<h2 class="ar__h" id="arH">' + n.title + '</h2><p class="ar__lead">' + n.text + '</p></div>' +
      '<figure class="ar__cover"><img src="' + (n.cover || n.img) + '" alt="" decoding="async"></figure></header>';
    // слева: у будущего мероприятия — дата и запись на вечер, у остальных — публикация и следующий шаг
    var side;
    if (isSoon(n)) {
      var w = (n.when || '').split(', ');
      side = '<div class="ar__card"><p class="dp__k"><i></i>Мероприятие</p><p class="ar__date">' + w[0] + '</p>' + (w[1] ? '<p class="ar__time">' + w[1] + '</p>' : '') +
        '<ul class="ar__facts">' + (n.place ? '<li>' + n.place + '</li>' : '') + (n.seats ? '<li>' + n.seats + '</li>' : '') + '</ul>' +
        '<form class="ar__reg" novalidate><label class="bk__f"><span>Имя</span><input name="name" type="text" autocomplete="given-name" placeholder="Как к&nbsp;вам обращаться"></label>' +
        '<label class="bk__f"><span>Телефон</span><input name="tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__"></label>' +
        '<button class="kbtn kbtn--wide" type="submit"><span>' + (n.cta || 'Записаться') + '</span><i>' + ARR + '</i></button></form></div>';
    } else {
      var next = n.tag === 'doctor' ? '<button class="kbtn kbtn--wide" type="button" data-ar-book="' + (SP[0] || '') + '"><span>Записаться к&nbsp;доктору</span><i>' + ARR + '</i></button>'
        : '<button class="kbtn kbtn--wide" type="button" data-ar-book=""><span>Записаться на&nbsp;диагностику</span><i>' + ARR + '</i></button>';
      side = '<div class="ar__card"><p class="dp__k"><i></i>' + TAG[n.tag] + '</p><ul class="ar__facts"><li>Опубликовано ' + dateRu(n.date) + '</li>' + (n.read ? '<li>' + n.read + '&nbsp;мин чтения</li>' : '') + '</ul>' +
        '<div class="ar__ext">' + next + (n.link ? '<a class="kbtn kbtn--wide kbtn--light" style="margin-top:calc(10 * var(--u));background:#F9F5F2" href="' + n.link + '" target="_blank" rel="noopener"><span>' + (n.linkText || 'Подробнее') + '</span><i>' + ARR + '</i></a>' : '') + '</div></div>';
    }
    var body = (n.body || [{ p: n.text }]).map(function (b) {
      if (b.p) return '<p>' + b.p + '</p>';
      if (b.h) return '<h3>' + b.h + '</h3>';
      if (b.ul) return '<ul>' + b.ul.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
      if (b.img) return '<div class="ar__pair">' + b.img.map(function (x) { return '<figure><img src="' + x + '" alt="" loading="lazy" decoding="async"></figure>'; }).join('') + '</div>' + (b.cap ? '<p class="ar__cap">' + b.cap + '</p>' : '');
      if (b.note) return '<div class="ar__note"><p>' + b.note + '</p></div>';
      return '';
    }).join('');
    h += '<div class="ar__grid"><aside class="ar__aside">' + side + '</aside><div class="ar__body">' + body + '</div></div>';
    var more = NEWS_ITEMS.filter(function (x) { return x.id !== n.id; }).slice(0, 2);
    if (more.length) h += '<section class="ar__more"><h3 class="ar__more-h">Читайте также</h3><div class="ar__more-g">' + more.map(function (x) {
      return '<button class="ar__mc" type="button" data-ar-go="' + x.id + '"><span><img src="' + x.img + '" alt="" loading="lazy" decoding="async"></span><span><span class="lf__meta" style="--c:' + DOT[x.tag] + ';margin:0"><i></i>' + TAG[x.tag] + ' · ' + dateRu(x.date) + '</span><b>' + x.title + '</b><em>Читать' + ARR_R + '</em></span></button>';
    }).join('') + '</div></section>';
    return h;
  }
  function arOpen(id) {
    var n = NEWS_ITEMS.filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    var url = '#news-' + id;
    // ПК: адрес статьи — на месте текущего; телефон: отдельный шаг истории (openM), «назад» закрывает статью
    if (!useHist() || ar.classList.contains('is-open')) history.replaceState(history.state, '', url);
    if (ar.classList.contains('is-open')) {
      // уже открыта другая статья — меняем содержимое на месте и поднимаемся к началу
      arIn.classList.add('is-swap');
      setTimeout(function () { arIn.innerHTML = arHtml(n); arSheet.scrollTop = 0; arIn.classList.remove('is-swap'); }, 300);
      return;
    }
    arIn.innerHTML = arHtml(n); arSheet.scrollTop = 0;
    openM(ar, useHist() ? url : null);
  }
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-news-open]');
    if (o) { e.preventDefault(); arOpen(o.getAttribute('data-news-open')); return; }
    var g = e.target.closest('[data-ar-go]');
    if (g) { arOpen(g.getAttribute('data-ar-go')); return; }
    var b = e.target.closest('[data-ar-book]');
    if (b) { openSheet(b.getAttribute('data-ar-book')); return; }
  });
  ar.addEventListener('submit', function (e) {
    var f = e.target.closest('.ar__reg');
    if (!f) return;
    e.preventDefault();
    var ok = true, bad = function (el) { var w = el.closest('.bk__f'); w.classList.remove('is-bad'); void w.offsetWidth; w.classList.add('is-bad'); ok = false; };
    if (f.name.value.trim().length < 2) bad(f.name);
    if (f.tel.value.replace(/\D/g, '').length !== 11) bad(f.tel);
    if (!ok || f.classList.contains('is-busy')) return;
    var n = NEWS_ITEMS.filter(function (x) { return '#news-' + x.id === location.hash; })[0], plain = document.createElement('div');
    plain.innerHTML = n ? n.title : ($('#arH') || {}).innerHTML || '';
    f.classList.add('is-busy');
    sendLead({ kind: 'event', event: plain.textContent, name: f.name.value.trim(), tel: f.tel.value }).then(function (sent) {
      f.classList.remove('is-busy');
      if (!sent) { var b = $('button[type=submit] span', f); if (b) b.textContent = 'Не отправилось — позвоните нам'; return; }
      done();
    });
    function done() { f.outerHTML = '<div class="ar__ok"><span class="bk__check" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30"/><path d="M20 33l8 8 16-17"/></svg></span><div><b>Вы&nbsp;в&nbsp;списке гостей</b>Накануне пришлём напоминание на&nbsp;' + f.tel.value + '</div></div>'; }
  });
  ar.addEventListener('input', function (e) {
    if (e.target.name === 'tel' && e.target.closest('.ar__reg')) e.target.value = telFmt(e.target.value);
    var w = e.target.closest('.bk__f'); if (w) w.classList.remove('is-bad');
  });
  // телефон: системное «Поделиться» (мессенджеры, заметки), если браузер его даёт; иначе — копия ссылки
  var canShare = MOB && !!navigator.share;
  if (canShare) $('[data-ar-share] span').textContent = 'Поделиться';
  $('[data-ar-share]').addEventListener('click', function () {
    var b = this, url = location.href;
    if (canShare) { navigator.share({ title: ($('#arH') || {}).textContent || document.title, url: url }).catch(function () {}); return; }
    var done = function () { b.classList.add('is-done'); $('span', b).textContent = 'Ссылка скопирована'; setTimeout(function () { b.classList.remove('is-done'); $('span', b).textContent = 'Скопировать ссылку'; }, 2200); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
  });
  function arFromHash() { var m = /^#news-([\w-]+)$/.exec(location.hash); if (m) arOpen(m[1]); }
  window.addEventListener('hashchange', arFromHash);
  arFromHash();

  /* плеер: окно по центру вырастает из карточки, на которой нажали, и при закрытии уходит обратно в неё.
     Размер — по пропорции ролика (data-ar), не больше 86 % ширины и 82 % высоты окна; старт — --from
     (сдвиг к середине карточки и её масштаб). Пока ролик грузится, в окне — его кадр-обложка. */
  var pBox = $('#playerBox');
  function playerFrom(b) {
    var ratio = +b.getAttribute('data-ar') || 16 / 9;
    // на телефоне окно почти во всю ширину: горизонтальный ролик в 86 % ширины был бы мелким
    var w = MOB ? Math.min(vw - 16, (vh - 150) * ratio) : Math.min(vw * .86, vh * .82 * ratio), h = w / ratio;
    pBox.style.width = w.toFixed(1) + 'px';
    pBox.style.height = h.toFixed(1) + 'px';
    var r = b.getBoundingClientRect(), sc = Math.min(r.width / w, r.height / h);
    var dx = r.left + r.width / 2 - vw / 2, dy = r.top + r.height / 2 - vh / 2;
    player.style.setProperty('--from', 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sc.toFixed(4) + ')');
  }
  $$('[data-video]').forEach(function (b) {
    b.addEventListener('click', function () {
      var src = (MOB && b.getAttribute('data-video-m')) || b.getAttribute('data-video');   // телефон: лёгкая версия 720p, если есть
      playerFrom(b);
      pv.poster = b.getAttribute('data-video').replace(/\.mp4$/, '.jpg');
      pv.src = src;
      void pBox.offsetWidth;   // стартовое положение — до перехода
      openM(player);
      var p = pv.play(); if (p) p.catch(function () {});
    });
  });


  /* ═════════ карта «Контактов»: живая (Leaflet + тайлы Яндекса, EPSG:3395) ═════════
     Грузится, когда блок подходит к экрану; до первого тайла (или если Яндекс недоступен) виден статичный снимок.
     Колесо карте не отдаём — им листается страница (smooth.js); карта тянется мышью, масштаб — кнопками.
     Метка — на (900, 360) кадра сцены 1710×680: правее стеклянной карточки. */
  var ctMap = $('#ctMap'), CT = { live: false, io: null, pin: null };
  // Leaflet (147 КБ) качаем только на ПК и только когда блок подходит к экрану
  function ctLeaflet(cb) {
    if (window.L) { cb(); return; }
    var s = document.createElement('script'); s.src = 'vendor/leaflet.js'; s.onload = cb; document.head.appendChild(s);
  }
  function ctInit() {
    if (!ctMap) return;
    if (MOB) { ctPinM(); return; }
    if (CT.live || CT.io) return;
    CT.io = new IntersectionObserver(function (es, o) {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      ctLeaflet(ctLive);
    }, { rootMargin: '1000px' });
    CT.io.observe(ctMap);
  }
  /* телефон: снимок карты (img/ct-map-m.webp, точка центра на 30 % / 55 % кадра) и та же метка с фото входа;
     касание карты открывает Яндекс Карты (там маршрут), касание ярлыка — фото входа */
  function ctPinM() {
    if (CT.pin) return;
    var w = document.createElement('div');
    w.className = 'ct__pinm m-only';   // на ПК (после поворота планшета) метку ставит живая карта
    w.innerHTML = $('#ctPin').innerHTML;
    ctMap.appendChild(w);
    CT.pin = w;
    $('#ctCopy').textContent = '© Яндекс';
  }
  function ctLive() {
    if (CT.live || MOB) return;
    CT.live = true;
    var org = [+ctMap.getAttribute('data-lat'), +ctMap.getAttribute('data-lon')], Z = 17;
    var m = L.map('ctLf', { crs: L.CRS.EPSG3395, zoomControl: false, attributionControl: false, scrollWheelZoom: false,
      minZoom: 12, maxZoom: 19, zoomSnap: 1, inertia: true, keyboard: false });
    var dpr = (window.devicePixelRatio || 1) > 1 ? 2 : 1, loaded = false;
    L.tileLayer('https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=' + dpr + '&lang=ru_RU', { maxZoom: 19 })
      .on('tileload', function () {
        if (loaded) return;
        loaded = true; ctMap.classList.add('is-live');
        $('#ctCopy').textContent = '© Яндекс';
      }).addTo(m);
    function place(z, anim) {
      var w = ctMap.clientWidth, h = ctMap.clientHeight;
      var p = m.project(org, z).subtract([900 / 1710 * w - w / 2, 360 / 680 * h - h / 2]);
      m.setView(m.unproject(p, z), z, { animate: !!anim });
    }
    place(Z);
    L.marker(org, { keyboard: false, icon: L.divIcon({ className: 'ct__mk', html: $('#ctPin').innerHTML, iconSize: [26, 40], iconAnchor: [10.5, 40] }) }).addTo(m);
    $$('[data-zoom]').forEach(function (b) {
      b.addEventListener('click', function () { m.setZoom(m.getZoom() + +b.getAttribute('data-zoom')); });
    });
    window.addEventListener('resize', function () { m.invalidateSize(); });
  }
  ctInit();
  // снимок карты (≈140 КБ) ленивый: браузер начинал качать его у самого экрана, и на медленной сети блок стоял серым.
  // Начинаем за ~3 экрана до «Контактов»
  (function () {
    var st = $('.ct__still');
    if (!st || !ctSec) return;
    new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { o.disconnect(); st.loading = 'eager'; } }, { rootMargin: '3000px 0px' }).observe(ctSec);
  })();

  /* фото входа: окно с двумя кадрами (угол дома и дверь) вырастает из миниатюры на метке и уходит обратно в неё.
     Кадры (≈ 550 КБ) качаются, только когда «Контакты» подходят к экрану, а не вместе со страницей */
  var ent = $('#ent'), entBox = $('#entBox');
  function entLoad() { $$('img[data-src]', entBox).forEach(function (i) { if (!i.getAttribute('src')) i.src = i.getAttribute('data-src'); }); }
  if (ent && ctSec) new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { o.disconnect(); entLoad(); } }, { rootMargin: '600px' }).observe(ctSec);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ent]');
    if (!b || !ent) return;
    e.preventDefault(); e.stopPropagation();
    var vw = innerWidth, vh = innerHeight;
    var eh = Math.min(vh * .72, (vw * .88 - 12) / (1.5 + .6667)), w = eh * (1.5 + .6667) + 12, h = eh + 60;
    // телефон: кадры друг под другом во всю ширину (mobile.css), окно листается, если не влезает
    if (MOB) { w = vw - 24; eh = w / 1.5; }
    entBox.style.setProperty('--eh', eh.toFixed(1) + 'px');
    entBox.style.width = w.toFixed(1) + 'px';
    var r = ($('.ct__th', b) || b).getBoundingClientRect(), sc = MOB ? r.width / w : r.height / eh;
    var dx = r.left + r.width / 2 - vw / 2, dy = r.top + r.height / 2 - vh / 2;
    ent.style.setProperty('--from', 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + sc.toFixed(4) + ')');
    entLoad();
    void entBox.offsetWidth;
    openM(ent);
  });

  /* ═════════ 8. ОТЗЫВЫ: при наведении ролик играет без звука (грузится только тогда), клик — плеер со звуком (выше).
     Плашка рейтинга и «Все отзывы» открывают панель с официальным виджетом Яндекс Карт — он грузится при первом открытии ═════════ */
  $$('.rvf').forEach(function (b) {
    var v = $('video', b), on = false;
    if (!v || reduced) return;
    b.addEventListener('mouseenter', function () {
      on = true;
      if (!v.getAttribute('src')) v.src = v.getAttribute('data-src');
      var p = v.play();
      if (p) p.then(function () { if (on) b.classList.add('is-play'); else v.pause(); }).catch(function () {});
    });
    b.addEventListener('mouseleave', function () {
      on = false;
      b.classList.remove('is-play');
      setTimeout(function () { if (!on) v.pause(); }, 650);
    });
  });
  /* окно «Что пишут гости»: все отзывы листаются внутри (снимок с Карт — reviews-data.js, грузится при первом открытии),
     текст обрезан до шести строк, «Читать полностью» раскрывает его на месте */
  var rwp = $('#rwp'), rwpList = $('#rwpList');
  var MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function rwpEsc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rwpDate(d) { var p = d.split('-'); return +p[2] + ' ' + MON[+p[1] - 1] + ' ' + p[0]; }
  function rwpStars(n) { var s = ''; for (var i = 0; i < 5; i++) s += '<svg' + (i < n ? '' : ' class="is-off"') + '><use href="#i-star"/></svg>'; return s; }
  function rwpClamp() {
    $$('.rwc__t', rwpList).forEach(function (t) {
      var c = t.closest('.rwc');
      if (c.classList.contains('is-open')) return;
      c.classList.toggle('is-long', t.scrollHeight > t.clientHeight + 2);
    });
  }
  function rwpRender() {
    var list = window.RWP_REVIEWS || [];
    rwpList.innerHTML = list.map(function (r) {
      return '<article class="rwc"><div class="rwc__head"><span class="rwc__ava" aria-hidden="true">' + rwpEsc(r.n.trim().charAt(0).toUpperCase()) + '</span>' +
        '<div><b class="rwc__n">' + rwpEsc(r.n) + '</b><span class="rwc__d">' + rwpDate(r.d) + '</span></div>' +
        '<span class="rwc__s" role="img" aria-label="Оценка ' + r.s + ' из 5">' + rwpStars(r.s) + '</span></div>' +
        '<p class="rwc__t">' + rwpEsc(r.t) + '</p><button class="rwc__more" type="button">Читать полностью</button></article>';
    }).join('') + '<p class="rwp__end">Все ' + list.length + ' отзывов с&nbsp;Яндекс Карт</p>';
    requestAnimationFrame(rwpClamp);
  }
  rwpList.addEventListener('click', function (e) {
    var b = e.target.closest('.rwc__more');
    if (!b) return;
    var c = b.closest('.rwc'), open = c.classList.toggle('is-open');
    b.textContent = open ? 'Свернуть' : 'Читать полностью';
    if (!open && c.getBoundingClientRect().top < rwpList.getBoundingClientRect().top) c.scrollIntoView({ block: 'start' });
  });
  window.addEventListener('resize', function () { if (rwpList.firstChild) rwpClamp(); });
  $$('[data-rwp]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!rwpList.firstChild) {
        if (window.RWP_REVIEWS) rwpRender();
        else { var s = document.createElement('script'); s.src = 'reviews-data.js'; s.onload = rwpRender; document.head.appendChild(s); }
      }
      openM(rwp);
    });
  });

  /* ═════════ 11. КОНТАКТЫ: открыто ли сейчас — по времени Москвы (Пн–Пт 11–20, Сб 11–19, Вс — выходной) ═════════ */
  (function () {
    var el = $('#ctNow');
    if (!el || !window.Intl) return;
    // по дням недели, 0 — воскресенье: null — выходной, иначе ['11:00', '20:00'] (часы — в админке, «Контакты»)
    var mins = function (x) { var p = String(x).split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
    var HRS = (SITE.hours || []).map(function (h) { return h ? [mins(h[0]), mins(h[1]), h[0], h[1]] : null; });
    if (!HRS.some(Boolean)) return;
    var DAYS = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
    function msk() {
      var p = {};
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Moscow', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
          .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      } catch (e) { return null; }
      return { d: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), m: (+p.hour % 24) * 60 + (+p.minute) };
    }
    function draw() {
      var t = msk();
      if (!t || t.d < 0) return;
      var h = HRS[t.d], open = false, txt;
      if (h && t.m >= h[0] && t.m < h[1]) { open = true; txt = 'Открыто до ' + h[3]; }
      else if (h && t.m < h[0]) txt = 'Откроемся в ' + h[2];
      else {
        var d = (t.d + 1) % 7;
        while (!HRS[d]) d = (d + 1) % 7;
        txt = 'Откроемся ' + (d === (t.d + 1) % 7 ? 'завтра' : DAYS[d]) + ' в ' + HRS[d][2];
      }
      [el, $('#mmNow')].forEach(function (x) {   // то же — в меню телефона
        if (!x) return;
        x.classList.toggle('is-open', open);
        $('span', x).textContent = txt;
      });
    }
    draw();
    setInterval(draw, 60000);
  })();

  /* ═════════ волна по буквам (как у кнопок goodlifemeds.com) ═════════
     текст режется на буквы (.ch, индекс --ci), слова — неразрывные обёртки.
     Кнопки: при наведении буквы по очереди тускнеют, размываются и сжимаются и возвращаются (.is-wave).
     «Следуйте за белым кроликом» — та же волна сама по себе, в цикле с прыжком кролика (about.css). */
  function splitChars(el) {
    var n = 0, nodes = [];
    (function walk(x) { x.childNodes.forEach(function (c) { if (c.nodeType === 3) nodes.push(c); else if (c.nodeType === 1) walk(c); }); })(el);
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      node.textContent.split(/( +)/).forEach(function (w) {
        if (!w) return;
        if (/^ +$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return; }
        var word = document.createElement('k-w');  // свои теги: стили «.btn span» и т. п. их не задевают
        word.className = 'chw';
        for (var i = 0; i < w.length; i++) {
          var ch = document.createElement('k-c');
          ch.className = 'ch';
          ch.style.setProperty('--ci', n++);
          ch.textContent = w[i];
          word.appendChild(ch);
        }
        frag.appendChild(word);
      });
      node.parentNode.replaceChild(frag, node);
    });
    return n;
  }
  $$('.hv__cta>span,.hd__cta>span,.cx__btn>span,.kbtn>span').forEach(function (t) {
    var btn = t.parentNode, n = splitChars(t), tm;
    if (!btn.hasAttribute('aria-label')) btn.setAttribute('aria-label', t.textContent);
    if (reduced) return;
    btn.addEventListener('mouseenter', function () {
      t.classList.remove('is-wave');
      void t.offsetWidth;
      t.classList.add('is-wave');
      clearTimeout(tm);
      tm = setTimeout(function () { t.classList.remove('is-wave'); }, 420 + n * 19);
    });
  });
  $$('.ab__follow>span').forEach(splitChars);

  /* ═════════ якоря и подсветка пунктов меню ═════════ */
  $$('a[href^="#"]').forEach(function (a) {
    var id = a.getAttribute('href');
    if (id.length < 2 || a.hasAttribute('data-book') || a.hasAttribute('data-msg')) return;
    a.addEventListener('click', function (e) {
      var t = document.getElementById(id.slice(1));
      if (!t) return;
      e.preventDefault();
      var y = t.getBoundingClientRect().top + window.scrollY;
      if (id === '#top') y = 0;
      if (sm && sm.active) sm.to(y); else window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });
  var navLinks = $$('.hd__nav a');
  var sio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      navLinks.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('href') === '#' + e.target.id); });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section[id]').forEach(function (s) { sio.observe(s); });
})();
