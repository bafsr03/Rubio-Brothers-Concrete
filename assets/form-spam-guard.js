/**
 * Client-side spam guard for native Shopify {% form %} elements.
 *
 * Opt a form in by rendering `snippets/spam-guard-fields.liquid` inside it,
 * which adds `data-spam-guard` plus the honeypot / timestamp inputs.
 *
 * Three cheap checks, all run on submit:
 *   1. Honeypot  — a hidden field no human can see; bots fill every input.
 *   2. Time trap — a form completed faster than a human can type is a script.
 *   3. Link flood — lead forms for a concrete company never need 2+ URLs.
 *
 * None of this is server-side: a bot that POSTs straight to /contact skips the
 * page entirely. Shopify's built-in reCAPTCHA (Admin → Settings → spam
 * protection) is the server-side layer; this stops the browser-driven bots
 * that solve nothing and just fill in fields.
 */

const MIN_FILL_SECONDS = 3;
const MAX_LINKS = 1;
const URL_PATTERN = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ru|cn|xyz|top|info|biz|club|online|site)\b)/gi;

/** @param {HTMLFormElement} form @param {string} message */
function reject(form, message) {
  let notice = form.querySelector('[data-spam-guard-notice]');

  if (!notice) {
    notice = document.createElement('p');
    notice.setAttribute('data-spam-guard-notice', '');
    notice.setAttribute('role', 'alert');
    notice.setAttribute('tabindex', '-1');
    notice.className = 'spam-guard__notice';
    // Styled inline so the snippet stays drop-in for any form's stylesheet.
    notice.style.cssText = 'margin: 0 0 0.75rem; font-weight: 600; color: #c42a20;';
    form.prepend(notice);
  }

  notice.textContent = message;
  notice.focus();
}

/** @param {HTMLFormElement} form */
function guard(form) {
  const renderedAt = Date.now();

  form.addEventListener('submit', (event) => {
    const honeypot = form.querySelector('[data-spam-guard-honeypot]');
    const body = form.querySelector('[name="contact[body]"]');
    const elapsed = (Date.now() - renderedAt) / 1000;

    // 1. Honeypot — hidden from humans, irresistible to bots.
    if (honeypot instanceof HTMLInputElement && honeypot.value.trim() !== '') {
      event.preventDefault();
      reject(form, 'Sorry — we could not send that. Please call us instead.');
      return;
    }

    // 2. Submitted too fast to have been typed.
    if (elapsed < MIN_FILL_SECONDS) {
      event.preventDefault();
      reject(form, 'That was a little too quick — please take a moment and send again.');
      return;
    }

    // 3. Link flood in the message body.
    if (body instanceof HTMLTextAreaElement) {
      const links = body.value.match(URL_PATTERN) || [];
      if (links.length > MAX_LINKS) {
        event.preventDefault();
        reject(form, 'Please remove the links from your message so we can send it.');
        return;
      }
    }
  });
}

const GUARDED = new WeakSet();

function scan() {
  document.querySelectorAll('form[data-spam-guard]').forEach((form) => {
    if (!(form instanceof HTMLFormElement) || GUARDED.has(form)) return;
    GUARDED.add(form);
    guard(form);
  });
}

scan();
// Re-scan for forms that arrive later (theme editor section reloads).
document.addEventListener('shopify:section:load', scan);
