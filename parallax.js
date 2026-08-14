/* ============================================================
   Parallax + scroll reveal
   rAF-throttled, transform-only (no layout thrash)
   auto-disabled under 760px and for prefers-reduced-motion
   ============================================================ */
(function () {
  var mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqSmall  = window.matchMedia('(max-width: 760px)');

  /* ---------- scroll reveal (runs everywhere; cheap + accessible) ---------- */
  var revealEls = [].slice.call(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window && !mqMotion.matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- layered parallax ---------- */
  var layers = [].slice.call(document.querySelectorAll('[data-speed]'));
  var ticking = false;

  function enabled() { return !mqMotion.matches && !mqSmall.matches; }

  /* Cache each layer's natural center (document coords, no transform applied)
     so parallax is measured RELATIVE to where the layer sits — not from the
     absolute top of the page. Without this, layers deep in the page accumulate
     a huge offset and drift far from their intended position. */
  function measure() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    for (var i = 0; i < layers.length; i++) {
      var el = layers[i];
      var prev = el.style.transform;
      el.style.transform = '';
      var rect = el.getBoundingClientRect();
      el.style.transform = prev;
      el._baseCenter = rect.top + window.pageYOffset + rect.height / 2;
    }
    _vhHalf = vh / 2;
  }

  var _vhHalf = 0;

  function apply() {
    var y = window.pageYOffset;
    for (var i = 0; i < layers.length; i++) {
      var el = layers[i];
      var speed = parseFloat(el.getAttribute('data-speed')) || 0;
      var spin  = parseFloat(el.getAttribute('data-spin'))  || 0;
      /* distance of this layer's center from the viewport center */
      var rel = (y + _vhHalf) - (el._baseCenter || 0);
      el.style.transform =
        'translate3d(0,' + (rel * speed).toFixed(2) + 'px,0)' +
        (spin ? ' rotate(' + (rel * spin).toFixed(2) + 'deg)' : '');
    }
    ticking = false;
  }

  function onScroll() {
    if (!enabled() || ticking) return;
    ticking = true;
    window.requestAnimationFrame(apply);
  }

  function reset() {
    layers.forEach(function (el) { el.style.transform = ''; });
  }

  function sync() {
    if (enabled()) { measure(); apply(); } else { reset(); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', sync);
  window.addEventListener('load', sync);
  (mqSmall.addEventListener  ? mqSmall.addEventListener('change', sync)  : mqSmall.addListener(sync));
  (mqMotion.addEventListener ? mqMotion.addEventListener('change', sync) : mqMotion.addListener(sync));

  sync();
})();


/* ============================================================
   Scattered polaroid pile ("Also making")
   photos strewn across the section; hover brings one forward.
   click / Enter / Space selects a photo: it lifts and flips to
   show the note on its back.
   deselect intuitively: click it again, click empty space, or Esc.
   ============================================================ */
(function () {
  var scatter = document.querySelector('.scatter');
  if (!scatter) return;
  var cards = [].slice.call(scatter.querySelectorAll('.scatter-card'));
  if (!cards.length) return;

  var top = 10;
  var selected = null;

  function bringToTop(card) { card.style.zIndex = String(++top); }

  function flipOpen(card) {
    if (selected && selected !== card) flipClose(selected);
    selected = card;
    bringToTop(card);
    card.classList.add('is-flipped');
    card.setAttribute('aria-pressed', 'true');
  }

  function flipClose(card) {
    card.classList.remove('is-flipped');
    card.setAttribute('aria-pressed', 'false');
    if (selected === card) selected = null;
  }

  function toggle(card) {
    if (card.classList.contains('is-flipped')) flipClose(card);
    else flipOpen(card);
  }

  cards.forEach(function (card) {
    card.setAttribute('aria-pressed', 'false');

    /* hover or focus always raises it to the top — flipped or not */
    card.addEventListener('mouseenter', function () { bringToTop(card); });
    card.addEventListener('focus',      function () { bringToTop(card); });

    card.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle(card);
    });

    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        toggle(card);
      } else if (e.key === 'Escape' && card.classList.contains('is-flipped')) {
        flipClose(card);
      }
    });
  });

  /* click empty space anywhere deselects the open photo */
  document.addEventListener('click', function () {
    if (selected) flipClose(selected);
  });

  /* Esc from anywhere deselects */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && selected) flipClose(selected);
  });
})();


/* ============================================================
   Project card cover slideshow
   hover (or keyboard focus) a card: after a short pause on the
   thumbnail, cross-fade through the game's screenshots on a loop.
   leaving / blurring the card snaps back to the thumbnail.
   disabled under prefers-reduced-motion.
   ============================================================ */
(function () {
  var START_DELAY = 1000; /* stay on the thumbnail this long before cycling */
  var SLIDE_HOLD  = 2000; /* time each screenshot is shown */

  var mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var covers = [].slice.call(document.querySelectorAll('.card .cover'));

  covers.forEach(function (cover) {
    var slides = [].slice.call(cover.querySelectorAll('.slide'));
    if (slides.length < 2) return; /* nothing to cycle through */

    var startTimer = null;
    var interval = null;
    var idx = 0;

    function show(i) {
      slides[idx].classList.remove('is-active');
      idx = i;
      slides[idx].classList.add('is-active');
    }

    function reset() {
      clearTimeout(startTimer); startTimer = null;
      clearInterval(interval);  interval = null;
      show(0); /* back to the thumbnail */
    }

    function begin() {
      if (mqMotion.matches) return;
      clearTimeout(startTimer);
      startTimer = setTimeout(function () {
        show(1); /* first screenshot */
        interval = setInterval(function () {
          /* loop through the screenshots (skip the thumbnail at index 0) */
          var next = idx + 1;
          if (next >= slides.length) next = 1;
          show(next);
        }, SLIDE_HOLD);
      }, START_DELAY);
    }

    var card = cover.closest('.card');
    card.addEventListener('mouseenter', begin);
    card.addEventListener('mouseleave', reset);
    card.addEventListener('focusin',  begin);
    card.addEventListener('focusout', reset);
  });
})();
