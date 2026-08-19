/**
 * Assembles the mailto links for `snippets/protected-email.liquid`.
 *
 * The address is never present in the served HTML — only a base64 blob — so
 * address-harvesting crawlers (which read raw HTML and do not execute scripts)
 * come away empty. Real visitors get a normal clickable link.
 */

/** @param {Element} host */
function reveal(host) {
  const encoded = host.getAttribute('data-protected-email');
  if (!encoded) return;

  let address = '';
  try {
    address = atob(encoded);
  } catch {
    return; // Malformed value — leave the readable fallback text in place.
  }
  if (!address.includes('@')) return;

  const link = document.createElement('a');
  link.href = `mailto:${address}`;
  link.textContent = address;

  const linkClass = host.getAttribute('data-link-class');
  if (linkClass) link.className = linkClass;

  host.replaceChildren(link);
  host.removeAttribute('data-protected-email');
}

function scan() {
  document.querySelectorAll('[data-protected-email]').forEach(reveal);
}

scan();
// Re-scan for markup that arrives later (theme editor section reloads).
document.addEventListener('shopify:section:load', scan);
