/* ==========================================================================
   LEGALTY — Mobile nav toggle (progressive enhancement)
   --------------------------------------------------------------------------
   No external deps. Under 600px, injects a hamburger button that toggles the
   nav menu open/closed, flips `aria-expanded`, and toggles the `.nav-open`
   class. On desktop it is a no-op (the button is injected but hidden via CSS
   `display:none`, so it never appears or receives focus).

   Progressive enhancement: without this script the nav links remain in the
   DOM and the mobile CSS keeps them visible (`display:none` only applies when
   `js-nav` is present on <html>), so the page stays usable if JS fails.
   ========================================================================== */
(function () {
  'use strict';

  function initNav() {
    var header = document.querySelector('.site-header');
    var inner = document.querySelector('.site-header__inner');
    var nav = document.querySelector('.site-nav');
    var list = document.querySelector('.site-nav__list');

    // No shared shell on this page → nothing to enhance.
    if (!header || !inner || !nav || !list) {
      return;
    }

    // Mark the document so CSS only collapses the nav when a toggle exists.
    document.documentElement.classList.add('js-nav');

    // Ensure the nav has a stable id for aria-controls.
    if (!nav.id) {
      nav.id = 'primary-nav';
    }

    // Inject the hamburger button (rightmost element in the header inner).
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-toggle';
    button.setAttribute('aria-controls', nav.id);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', 'Abrir menú de navegación');
    button.innerHTML =
      '<span class="nav-toggle__bar" aria-hidden="true"></span>' +
      '<span class="nav-toggle__bar" aria-hidden="true"></span>' +
      '<span class="nav-toggle__bar" aria-hidden="true"></span>';
    inner.appendChild(button);

    var isOpen = false;

    function setOpen(open) {
      isOpen = open;
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute(
        'aria-label',
        open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'
      );
      nav.classList.toggle('nav-open', open);
      header.classList.toggle('nav-open', open);
    }

    button.addEventListener('click', function () {
      setOpen(!isOpen);
    });

    // Close on Escape and return focus to the toggle.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen) {
        setOpen(false);
        button.focus();
      }
    });

    // Close after activating a nav link (mobile navigation).
    list.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a') : null;
      if (link) {
        setOpen(false);
      }
    });

    // If the viewport crosses back to desktop, reset the open state so
    // aria-expanded never lingers as "true" while the list is static.
    var desktopQuery = window.matchMedia('(min-width: 601px)');
    function onBreakpointChange(query) {
      if (query.matches && isOpen) {
        setOpen(false);
      }
    }
    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', onBreakpointChange);
    } else if (typeof desktopQuery.addListener === 'function') {
      desktopQuery.addListener(onBreakpointChange);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNav);
  } else {
    initNav();
  }
})();
