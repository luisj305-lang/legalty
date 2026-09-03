/* ==========================================================================
   LEGALTY — Testimonials carousel (progressive enhancement)
   --------------------------------------------------------------------------
   No external deps. Advances between `.carousel__slide` elements by toggling
   the `.is-active` class. Auto-advances every 5s (paused on hover/focus) and
   honours `prefers-reduced-motion` (no auto-play when the user requests
   reduced motion). Optional `.carousel__prev` / `.carousel__next` buttons are
   wired if present.

   Empty state: if a carousel has no slides (testimonials still PENDING), this
   script does nothing and the static placeholder remains visible — the page
   degrades to a static list without JS.
   ========================================================================== */
(function () {
  'use strict';

  var INTERVAL_MS = 5000;

  function initCarousels() {
    var carousels = document.querySelectorAll('.carousel');

    Array.prototype.forEach.call(carousels, function (carousel) {
      var slides = carousel.querySelectorAll('.carousel__slide');

      // Empty state — no testimonials yet. Do nothing.
      if (!slides.length) {
        return;
      }

      // A single slide is not a carousel; just reveal it.
      if (slides.length === 1) {
        slides[0].classList.add('is-active');
        return;
      }

      var current = 0;
      var timer = null;

      function show(index) {
        Array.prototype.forEach.call(slides, function (slide, i) {
          var active = i === index;
          slide.classList.toggle('is-active', active);
          slide.setAttribute('aria-hidden', active ? 'false' : 'true');
        });
        current = index;
      }

      function next() {
        show((current + 1) % slides.length);
      }

      function prev() {
        show((current - 1 + slides.length) % slides.length);
      }

      function stop() {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }

      function start() {
        if (prefersReducedMotion() || slides.length < 2) {
          return;
        }
        stop();
        timer = setInterval(next, INTERVAL_MS);
      }

      function prefersReducedMotion() {
        return (
          window.matchMedia &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );
      }

      show(0);

      // Optional prev/next controls (present in markup when supplied).
      var prevBtn = carousel.querySelector('.carousel__prev');
      var nextBtn = carousel.querySelector('.carousel__next');
      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          stop();
          prev();
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          stop();
          next();
        });
      }

      // Pause auto-play on hover/focus; resume on leave/blur.
      carousel.addEventListener('mouseenter', stop);
      carousel.addEventListener('mouseleave', start);
      carousel.addEventListener('focusin', stop);
      carousel.addEventListener('focusout', start);

      // React to a live change in the reduced-motion preference.
      var motionQuery = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)');
      if (motionQuery && typeof motionQuery.addEventListener === 'function') {
        motionQuery.addEventListener('change', function () {
          if (prefersReducedMotion()) {
            stop();
          } else {
            start();
          }
        });
      }

      start();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarousels);
  } else {
    initCarousels();
  }
})();
