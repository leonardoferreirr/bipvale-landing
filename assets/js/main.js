/* ============================================================
   BIP VALE — motion engine
   Lenis + GSAP/ScrollTrigger com failsafes de visibilidade.
   ============================================================ */
(function () {
  'use strict';

  // avisa o watchdog do <head> que o motor carregou
  window.__bipReady = true;
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined';
  var hasST = hasGSAP && typeof window.ScrollTrigger !== 'undefined';

  /* ---------- Lenis smooth scroll ---------- */
  var lenis = null;
  if (typeof window.Lenis !== 'undefined' && !reduce) {
    lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
    window.__lenis = lenis;
    if (hasST) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      requestAnimationFrame(function raf(time) { lenis.raf(time); requestAnimationFrame(raf); });
    }
  }

  function scrollToId(id) {
    var el = document.querySelector(id);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -70 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }

  /* ---------- GSAP setup ---------- */
  if (hasST) window.gsap.registerPlugin(window.ScrollTrigger);

  /* ---------- Hero: reveal + parallax ---------- */
  if (hasGSAP && !reduce) {
    root.classList.add('gsap-on');
    // hero (título + fades) revela por CSS animation — o GSAP cuida só do parallax
    if (hasST) {
      window.gsap.to('.hero__media', {
        yPercent: 14, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
      window.gsap.to('.hero__inner', {
        yPercent: -8, opacity: 0.35, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
      });
    }

    // parallax leve de mouse no hero
    var hero = document.querySelector('.hero');
    var media = document.querySelector('.hero__media');
    if (hero && media && window.matchMedia('(hover:hover)').matches) {
      hero.addEventListener('mousemove', function (e) {
        var rx = (e.clientX / window.innerWidth - 0.5);
        var ry = (e.clientY / window.innerHeight - 0.5);
        window.gsap.to(media, { x: rx * -22, y: ry * -14, duration: 0.9, ease: 'power2.out', overwrite: 'auto' });
      });
    }
  }
  // revela o hero SEMPRE (título via CSS; cobre reduce e ausência de GSAP)
  requestAnimationFrame(function () { root.classList.add('is-loaded'); });

  /* ---------- Reveal genérico (IntersectionObserver) ----------
     [data-reveal-mask] começa com clip-path inset(0 0 100%), o que zera a área
     visível: um IO com threshold > 0 NUNCA dispara nesses (ratio fica 0). Por isso
     os masks usam threshold 0 (dispara pelo bounding box) + rootMargin negativo pro
     timing. Os data-reveal comuns seguem com threshold 0.15. */
  function revealObserver(threshold, rootMargin) {
    return new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target); }
      });
    }, { threshold: threshold, rootMargin: rootMargin });
  }
  if ('IntersectionObserver' in window && !reduce) {
    var ioReveal = revealObserver(0.15, '0px 0px -8% 0px');
    document.querySelectorAll('[data-reveal]').forEach(function (el) { ioReveal.observe(el); });
    var ioMask = revealObserver(0, '0px 0px -14% 0px');
    document.querySelectorAll('[data-reveal-mask]').forEach(function (el) { ioMask.observe(el); });
  } else {
    document.querySelectorAll('[data-reveal],[data-reveal-mask]').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Counters ---------- */
  function animateCount(el) {
    var target = parseFloat(el.dataset.count);
    var suffix = el.dataset.suffix || '';
    if (isNaN(target) || reduce) { return; }
    var dur = 1500, t0 = null;
    function fmt(n) { return Math.round(n).toLocaleString('pt-BR'); }
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target) + suffix;
    }
    el.textContent = '0' + suffix;
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && !reduce) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { animateCount(en.target); cio.unobserve(en.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ---------- Sticky-stack: só o empilhamento (sem escurecer os cards) ---------- */

  /* ---------- Marquee infinito (rAF, emenda sem buraco) ---------- */
  (function marquee() {
    if (reduce) return;
    var rows = document.querySelectorAll('.marquee__row');
    rows.forEach(function (row) {
      var dir = parseFloat(row.dataset.marquee) || 1;
      // duplica até a metade ficar mais larga que a viewport
      var original = row.innerHTML;
      var safety = 0;
      while (row.scrollWidth < window.innerWidth * 2 && safety < 10) { row.innerHTML += original; safety++; }
      row.innerHTML += row.innerHTML; // par de cópias -> -50% emenda perfeita
      var half = row.scrollWidth / 2;
      var x = dir < 0 ? -half : 0;
      var speed = 0.4 * dir;
      function tick() { x -= speed; if (x <= -half) x += half; if (x >= 0) x -= half; row.style.transform = 'translateX(' + x + 'px)'; requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
    });
  })();

  /* ---------- Reel de fotos reais (auto-rolando, pausa no hover) ---------- */
  (function reel() {
    var track = document.querySelector('[data-reel-track]');
    if (!track) return;
    var wrap = track.closest('[data-reel]');
    if (reduce) {
      // sem movimento: vira rolagem horizontal manual, sem máscara nas bordas
      if (wrap) { wrap.style.overflowX = 'auto'; wrap.style.webkitMaskImage = 'none'; wrap.style.maskImage = 'none'; }
      return;
    }
    track.innerHTML += track.innerHTML; // par de cópias -> emenda em -50%
    var half = track.scrollWidth / 2;
    var x = 0, speed = 0.5, paused = false;
    if (wrap) {
      wrap.addEventListener('mouseenter', function () { paused = true; });
      wrap.addEventListener('mouseleave', function () { paused = false; });
    }
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { half = track.scrollWidth / 2; if (x <= -half) x = 0; }, 200);
    });
    function tick() { if (!paused) { x -= speed; if (x <= -half) x += half; track.style.transform = 'translateX(' + x + 'px)'; } requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  })();

  /* ---------- Header: solid + progress + scrollspy ---------- */
  var header = document.getElementById('siteHeader');
  var progress = document.getElementById('scrollProgress');
  var waFloat = document.querySelector('.wa-float');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
  var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });

  function onScroll() {
    var y = window.scrollY;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (header) header.classList.toggle('is-solid', y > 40);
    if (progress) progress.style.width = (h > 0 ? (y / h * 100) : 0) + '%';
    if (waFloat) waFloat.classList.toggle('is-in', y > 500);
    // scrollspy
    var cur = '';
    sections.forEach(function (s) { if (s && s.getBoundingClientRect().top <= 140) cur = '#' + s.id; });
    navLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === cur); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Anchor smooth scroll ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length > 1 && document.querySelector(id)) {
        e.preventDefault();
        closeMenu();
        scrollToId(id);
      }
    });
  });

  /* ---------- Burger / mobile menu ---------- */
  var burger = document.getElementById('burger');
  var mobileMenu = document.getElementById('mobileMenu');
  function closeMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('is-open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  if (burger && mobileMenu) {
    burger.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('is-open');
      mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  /* ---------- Formato pré-selecionado + Form -> WhatsApp ---------- */
  var formatoSelect = document.getElementById('formato');
  document.querySelectorAll('[data-formato]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (formatoSelect) {
        var v = btn.dataset.formato;
        for (var i = 0; i < formatoSelect.options.length; i++) {
          if (formatoSelect.options[i].value.indexOf(v.split(' ')[0]) !== -1 || formatoSelect.options[i].text.indexOf(v.split(' ')[0]) !== -1) {
            formatoSelect.selectedIndex = i; break;
          }
        }
      }
    });
  });

  var form = document.getElementById('leadForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      ['nome', 'empresa', 'whats'].forEach(function (id) {
        var f = document.getElementById(id);
        var wrap = f.closest('.field');
        if (!f.value.trim()) { wrap.classList.add('field--err'); wrap.classList.remove('field--ok'); ok = false; }
        else { wrap.classList.remove('field--err'); wrap.classList.add('field--ok'); }
      });
      var fmt = document.getElementById('formato');
      if (!fmt.value) { fmt.closest('.field').classList.add('field--err'); ok = false; }
      else { fmt.closest('.field').classList.remove('field--err'); }
      if (!ok) return;

      var msg = 'Olá! Quero informações sobre o BIP VALE.%0A%0A'
        + 'Nome: ' + encodeURIComponent(document.getElementById('nome').value) + '%0A'
        + 'Empresa: ' + encodeURIComponent(document.getElementById('empresa').value) + '%0A'
        + 'WhatsApp: ' + encodeURIComponent(document.getElementById('whats').value) + '%0A'
        + 'Formato de interesse: ' + encodeURIComponent(fmt.value);
      window.open('https://wa.me/5512997544218?text=' + msg, '_blank');
    });
  }

  // Modal Política de Privacidade
  var privacyModal = document.getElementById('privacyModal');
  if (privacyModal) {
    var openPrivacy = function (e) {
      if (e) e.preventDefault();
      privacyModal.hidden = false;
      requestAnimationFrame(function () { privacyModal.classList.add('is-open'); });
      document.body.style.overflow = 'hidden';
    };
    var closePrivacy = function () {
      privacyModal.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(function () { privacyModal.hidden = true; }, 300);
    };
    document.querySelectorAll('[data-privacy]').forEach(function (a) { a.addEventListener('click', openPrivacy); });
    privacyModal.querySelectorAll('[data-privacy-close]').forEach(function (b) { b.addEventListener('click', closePrivacy); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && privacyModal.classList.contains('is-open')) closePrivacy(); });
  }

  // refresh ScrollTrigger depois que imagens/fontes carregam (altura muda)
  if (hasST) {
    window.addEventListener('load', function () { window.ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { window.ScrollTrigger.refresh(); });
  }
})();
