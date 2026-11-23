/**
 * Lead tracking (GA4).
 *
 * Sends the events that matter for a lead-gen site:
 *   generate_lead   — a contact/estimate form was accepted by Shopify
 *   phone_click     — tap on any tel: link
 *   text_click      — tap on any sms: link
 *   estimator_used  — a visitor got a price from the estimator (once per page view)
 *   estimate_cta    — click through to the estimate page
 *   reviews_click   — click through to the Google reviews
 *
 * No personal data is ever sent: no names, phone numbers, emails or messages.
 *
 * generate_lead needs two signals: a submit in this tab (remembered in
 * sessionStorage) and a server-rendered [data-lead-success] on the page that
 * follows. Requiring both means a refresh of the thank-you state doesn't count twice.
 */

const PENDING_KEY = 'rb-lead-pending';

/** @param {string} name @param {Record<string, unknown>} [params] */
function send(name, params = {}) {
  const gtag = /** @type {any} */ (window).gtag;
  if (typeof gtag !== 'function') return;
  gtag('event', name, { page_path: window.location.pathname, ...params });
}

function readPending() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
  } catch {
    return null;
  }
}

/** @param {object | null} value */
function writePending(value) {
  try {
    if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage blocked (private mode): the lead still reaches the owner, it just isn't counted.
  }
}

/**
 * Where on the page a link sits, so calls from the sticky bar and hero can be told apart.
 * @param {Element} el
 */
function placement(el) {
  if (el.closest('.rb-callbar')) return 'sticky_bar';
  if (el.closest('#header-group')) return 'header';
  if (el.closest('.rb-footer')) return 'footer';
  if (el.closest('.rb-hero')) return 'hero';
  if (el.closest('concrete-estimator')) return 'estimator';
  if (el.closest('.rb-contact')) return 'contact';
  if (el.closest('.rb-cta')) return 'cta_band';
  return 'content';
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return;

  const href = link.getAttribute('href') || '';
  const params = { placement: placement(link) };

  if (href.startsWith('tel:')) send('phone_click', params);
  else if (href.startsWith('sms:')) send('text_click', params);
  else if (link.hasAttribute('data-reviews-link')) send('reviews_click', params);
  else if (link.pathname === '/pages/estimate' && window.location.pathname !== '/pages/estimate') {
    send('estimate_cta', params);
  }
});

// Capture phase: Shopify's captcha may cancel the submit and re-post the form itself.
document.addEventListener(
  'submit',
  (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-spam-guard')) return;

    const projectType = form.querySelector('[name="contact[Project type]"]');
    writePending({
      form: form.closest('concrete-estimator') ? 'estimator' : 'contact',
      project: projectType instanceof HTMLInputElement ? projectType.value : '',
      source_path: window.location.pathname,
    });
  },
  true
);

let estimatorSent = false;
document.addEventListener('rb:estimate', (event) => {
  if (estimatorSent || !(event instanceof CustomEvent)) return;
  estimatorSent = true;
  send('estimator_used', { project_type: event.detail?.jobType || '' });
});

const pending = readPending();
if (pending && document.querySelector('[data-lead-success]')) {
  writePending(null);
  send('generate_lead', {
    form_name: pending.form,
    project_type: pending.project,
    source_path: pending.source_path,
  });
}
