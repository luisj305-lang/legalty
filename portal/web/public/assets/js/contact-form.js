/* ==========================================================================
   LEGALTY — Contact form (progressive enhancement)
   --------------------------------------------------------------------------
   No external deps. Owns client-side validation and the /api/contact POST:

     1. On submit: validate name (non-empty), email (well-formed), message
        (non-empty). On invalid → prevent submit, show an inline error next to
        the offending field and set aria-invalid on it.
     2. On valid → POST JSON { name, email, message } to the form's
        data-endpoint (defaults to /api/contact).
     3. On success → show a success confirmation and reset the form.
     4. On failure → show an error message and PRESERVE the user's data.

   Progressive enhancement: if the form is absent the script is a no-op. The
   form carries `novalidate` so JS owns validation instead of the browser.
   ========================================================================== */
(function () {
  'use strict';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function trim(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function setFieldError(field, message) {
    var wrap = field.closest('.form-field');
    var error = wrap ? wrap.querySelector('.form-error') : null;
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
    field.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(field) {
    var wrap = field.closest('.form-field');
    var error = wrap ? wrap.querySelector('.form-error') : null;
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
    field.removeAttribute('aria-invalid');
  }

  function clearAllErrors(form) {
    Array.prototype.forEach.call(
      form.querySelectorAll('[aria-invalid="true"]'),
      clearFieldError
    );
  }

  function setStatus(form, text, kind) {
    var status = form.querySelector('.form-status');
    if (!status) {
      status = document.createElement('p');
      status.className = 'form-status';
      form.appendChild(status);
    }
    status.textContent = text;
    status.hidden = false;
    status.setAttribute('role', 'status');
    status.classList.toggle('form-status--error', kind === 'error');
    status.classList.toggle('form-status--success', kind === 'success');
  }

  function hideStatus(form) {
    var status = form.querySelector('.form-status');
    if (status) {
      status.hidden = true;
    }
  }

  function validate(form) {
    var name = form.elements.namedItem('name');
    var email = form.elements.namedItem('email');
    var message = form.elements.namedItem('message');

    var firstInvalid = null;

    if (!trim(name.value)) {
      setFieldError(name, 'Por favor ingrese su nombre.');
      firstInvalid = firstInvalid || name;
    } else {
      clearFieldError(name);
    }

    if (!trim(email.value) || !EMAIL_RE.test(trim(email.value))) {
      setFieldError(email, 'Por favor ingrese un correo electrónico válido.');
      firstInvalid = firstInvalid || email;
    } else {
      clearFieldError(email);
    }

    if (!trim(message.value)) {
      setFieldError(message, 'Por favor ingrese su mensaje.');
      firstInvalid = firstInvalid || message;
    } else {
      clearFieldError(message);
    }

    return firstInvalid;
  }

  function onSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;

    hideStatus(form);

    var firstInvalid = validate(form);
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    var endpoint = form.getAttribute('data-endpoint') || '/api/contact';
    var name = form.elements.namedItem('name');
    var email = form.elements.namedItem('email');
    var message = form.elements.namedItem('message');
    var button = form.querySelector('button[type="submit"]');

    if (button) {
      button.disabled = true;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trim(name.value),
        email: trim(email.value),
        message: trim(message.value)
      })
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
      .then(function () {
        if (button) {
          button.disabled = false;
        }
        setStatus(form, 'Mensaje enviado. Nos pondremos en contacto a la brevedad.', 'success');
        form.reset();
        clearAllErrors(form);
      })
      .catch(function () {
        if (button) {
          button.disabled = false;
        }
        // On failure, do NOT reset — preserve the user's entered data.
        setStatus(form, 'No pudimos enviar su mensaje. Inténtelo de nuevo más tarde.', 'error');
      });
  }

  function init() {
    var form = document.getElementById('contact-form');
    if (!form) {
      return;
    }
    form.addEventListener('submit', onSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
