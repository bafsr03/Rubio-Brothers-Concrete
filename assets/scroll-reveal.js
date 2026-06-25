import { Component } from '@theme/component';

/**
 * Reveals descendant elements as they scroll into view.
 *
 * Wrap content in <scroll-reveal> and tag children with `data-reveal`. Children
 * animate in with a stagger (configurable via `data-reveal-stagger`, ms). Honors
 * `prefers-reduced-motion` by showing everything immediately, and degrades to
 * fully-visible content when IntersectionObserver is unavailable.
 *
 * The actual transition is CSS-driven: `[data-reveal]` starts hidden, and the
 * `.is-revealed` class (added here) animates it to its resting state.
 *
 * @extends {Component}
 */
export class ScrollReveal extends Component {
  connectedCallback() {
    super.connectedCallback();

    /** @type {HTMLElement[]} */
    this.items = Array.from(this.querySelectorAll('[data-reveal]'));
    if (this.items.length === 0) this.items = [this];

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      this.revealAll();
      return;
    }

    this.stagger = Number(this.dataset.revealStagger) || 90;

    this.observer = new IntersectionObserver((entries) => this.onIntersect(entries), {
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.15,
    });

    for (const item of this.items) this.observer.observe(item);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  /** @param {IntersectionObserverEntry[]} entries */
  onIntersect(entries) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      const target = /** @type {HTMLElement} */ (entry.target);
      const index = this.items.indexOf(target);
      const delay = Math.max(0, index) * this.stagger;

      target.style.transitionDelay = `${delay}ms`;
      target.classList.add('is-revealed');
      this.observer?.unobserve(target);
    }
  }

  revealAll() {
    for (const item of this.items) item.classList.add('is-revealed');
  }
}

if (!customElements.get('scroll-reveal')) {
  customElements.define('scroll-reveal', ScrollReveal);
}
