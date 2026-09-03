/* ==========================================================================
   LEGALTY — Services checkout (progressive enhancement)
   --------------------------------------------------------------------------
   No external deps. Wires the `.pay-btn` / `[data-service-id]` buttons on the
   Servicios page to the create-preference endpoint:

     1. Read the clicked button's `data-service-id`.
     2. Look it up in the shared `SERVICES` catalog (catalog.js).
     3. If the service is missing → error message.
     4. If its price is null/undefined (PENDING) → show "price pending" and STOP.
     5. Otherwise POST `{ serviceId }` to /api/create-preference and, on success,
        redirect to the returned `init_point` (Mercado Pago Checkout Pro).

   A fetch/network error surfaces a visible inline message. The endpoint itself
   (api/create-preference.js) lands in a later unit; until then any click on a
   priced service would show the fetch-error message, never silently fail.
   ========================================================================== */
(function () {
  'use strict';

  var ENDPOINT = '/api/create-preference';

  function findService(serviceId) {
    if (typeof SERVICES === 'undefined' || !Array.isArray(SERVICES)) {
      return null;
    }
    return SERVICES.find(function (service) {
      return service.id === serviceId;
    }) || null;
  }

  function getOrCreateNote(button) {
    var note = button.parentElement.querySelector('.checkout-note');
    if (!note) {
      note = document.createElement('p');
      note.className = 'checkout-note';
      button.insertAdjacentElement('afterend', note);
    }
    return note;
  }

  function showMessage(button, text, kind) {
    var note = getOrCreateNote(button);
    note.textContent = text;
    note.setAttribute('role', 'status');
    note.classList.toggle('checkout-note--pending', kind === 'pending');
    note.classList.toggle('checkout-note--error', kind === 'error');
  }

  function onClick(event) {
    var button = event.target.closest
      ? event.target.closest('[data-service-id]')
      : null;
    if (!button) {
      return;
    }

    var serviceId = button.getAttribute('data-service-id');
    var service = findService(serviceId);

    if (!service) {
      showMessage(button, 'Servicio no encontrado. Por favor contáctenos.', 'error');
      return;
    }

    // Pricing not yet supplied — do not proceed to checkout.
    if (service.price === null || service.price === undefined || service.price === 'PENDING') {
      showMessage(button, 'Precio pendiente de confirmación. Por favor contáctenos.', 'pending');
      return;
    }

    button.disabled = true;

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: service.id })
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().catch(function () {
            return {};
          }).then(function (data) {
            var error = data && data.error ? data.error : 'request_failed';
            throw new Error(error);
          });
        }
        return response.json();
      })
      .then(function (data) {
        if (data && data.init_point) {
          window.location.href = data.init_point;
          return;
        }
        throw new Error('no_init_point');
      })
      .catch(function () {
        button.disabled = false;
        showMessage(button, 'No pudimos iniciar el pago. Inténtelo de nuevo más tarde.', 'error');
      });
  }

  document.addEventListener('click', onClick);
})();
