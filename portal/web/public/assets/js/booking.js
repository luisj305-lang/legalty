// Public booking flow for call services (llamada-30min / llamada-45min).
// It lists available slots from the read-only endpoint, registers the
// appointment BEFORE payment through /api/call-booking, and only then creates
// the Mercado Pago preference. A taken instant surfaces as slot_taken and the
// visitor is asked to pick another slot.
(function () {
  'use strict';

  var SLOTS_ENDPOINT = '/api/call-slots';
  var BOOKING_ENDPOINT = '/api/call-booking';
  var PAYMENT_ENDPOINT = '/api/create-preference';

  var form = document.getElementById('booking-form');
  if (!form) return;

  var service = document.getElementById('booking-service');
  var slot = document.getElementById('booking-slot');
  var nameInput = document.getElementById('booking-name');
  var emailInput = document.getElementById('booking-email');
  var phoneInput = document.getElementById('booking-phone');
  var status = document.getElementById('slots-status');
  var result = document.getElementById('booking-result');
  var button = document.getElementById('booking-continue');

  // America/Bogota is fixed at UTC-5 (no DST), so Intl rendering is stable.
  var bogota = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function setStatus(node, message, isError) {
    node.hidden = false;
    node.textContent = message;
    node.classList.toggle('form-status--error', !!isError);
  }

  function formatSlot(value) {
    var date = new Date(value);
    return isNaN(date.getTime()) ? null : bogota.format(date);
  }

  // Preselect the service from `?servicio=<id>`, falling back to the select.
  function preselectService() {
    var requested;
    try {
      requested = new URLSearchParams(window.location.search).get('servicio');
    } catch (err) {
      requested = null;
    }
    if (!requested) return;
    for (var i = 0; i < service.options.length; i += 1) {
      if (service.options[i].value === requested) {
        service.value = requested;
        return;
      }
    }
  }

  function showResult(message, isError) {
    setStatus(result, message, isError);
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  // Loads (or reloads) the available instants. Each option value is the
  // starts_at instant; the label is always rendered in America/Bogota.
  function loadSlots() {
    slot.disabled = true;
    button.disabled = true;
    fetch(SLOTS_ENDPOINT, { headers: { accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('unavailable');
        return response.json();
      })
      .then(function (payload) {
        var slots = payload && Array.isArray(payload.slots) ? payload.slots : [];
        slot.innerHTML = '';

        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = slots.length === 0 ? 'No hay horarios disponibles' : 'Seleccione un horario';
        slot.appendChild(placeholder);

        var added = 0;
        slots.forEach(function (item) {
          var label = formatSlot(item.starts_at);
          if (!label) return;
          var option = document.createElement('option');
          option.value = item.starts_at;
          option.textContent = label;
          slot.appendChild(option);
          added += 1;
        });

        if (added === 0) {
          slot.disabled = true;
          button.disabled = true;
          setStatus(status, 'No hay horarios disponibles en este momento. Escriba a legaltyceo@gmail.com para coordinar su llamada.', true);
          return;
        }

        slot.disabled = false;
        button.disabled = false;
        setStatus(status, added + (added === 1 ? ' horario disponible.' : ' horarios disponibles.'), false);
      })
      .catch(function () {
        slot.innerHTML = '';
        var unavailableOption = document.createElement('option');
        unavailableOption.value = '';
        unavailableOption.textContent = 'No disponible';
        slot.appendChild(unavailableOption);
        slot.disabled = true;
        button.disabled = true;
        setStatus(status, 'No pudimos cargar los horarios. Intente de nuevo más tarde o escriba a legaltyceo@gmail.com.', true);
      });
  }

  preselectService();
  loadSlots();

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (button.disabled) return;

    var serviceId = service.value;
    var startsAt = slot.value;
    var clientName = nameInput ? nameInput.value.trim() : '';
    var clientEmail = emailInput ? emailInput.value.trim() : '';
    var clientPhone = phoneInput ? phoneInput.value.trim() : '';

    if (!serviceId || !startsAt) {
      showResult('Seleccione el servicio y un horario para continuar.', true);
      return;
    }
    if (!clientName || !clientEmail || !clientPhone) {
      showResult('Complete su nombre, correo electrónico y teléfono para continuar.', true);
      return;
    }
    if (!validEmail(clientEmail)) {
      showResult('Escriba un correo electrónico válido.', true);
      return;
    }

    button.disabled = true;
    showResult('Registrando su cita…', false);

    fetch(BOOKING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startsAt: startsAt,
        serviceId: serviceId,
        clientName: clientName,
        clientEmail: clientEmail,
        clientPhone: clientPhone,
      }),
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          return { status: response.status, ok: response.ok, data: data };
        });
      })
      .then(function (response) {
        if (response.status === 409 && response.data && response.data.error === 'slot_taken') {
          button.disabled = false;
          showResult('Ese horario acaba de ser reservado por otra persona. Actualizamos los horarios disponibles; elija otro.', true);
          loadSlots();
          return;
        }
        if (!response.ok || !response.data || !response.data.appointmentId) {
          throw new Error('booking_failed');
        }
        var appointmentId = response.data.appointmentId;

        // The appointment is registered; now start the payment. The appointment
        // id travels as the preference reference so the payment can be matched.
        showResult('Cita registrada. Preparando el pago…', false);
        return fetch(PAYMENT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: serviceId,
            slotId: appointmentId,
            clientName: clientName,
            clientEmail: clientEmail,
            clientPhone: clientPhone,
          }),
        })
          .then(function (response) {
            if (!response.ok) throw new Error('payment_failed');
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
            showResult('Su cita quedó registrada, pero no pudimos iniciar el pago. Escriba a legaltyceo@gmail.com indicando el horario elegido para completarlo.', true);
          });
      })
      .catch(function () {
        button.disabled = false;
        showResult('No pudimos registrar su cita. Inténtelo de nuevo más tarde o escriba a legaltyceo@gmail.com.', true);
      });
  });
})();
