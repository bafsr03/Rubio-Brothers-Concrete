import { Component } from '@theme/component';

/**
 * Animated stat counters.
 *
 * Each descendant `[data-count-to]` counts up from 0 to its target value once
 * it scrolls into view. Honors `prefers-reduced-motion` (shows the final value
 * immediately) and degrades gracefully without IntersectionObserver.
 *
 * @extends {Component}
 */
export class StatsCounter extends Component {
  connectedCallback() {
    super.connectedCallback();

    /** @type {HTMLElement[]} */
    this.counters = Array.from(this.querySelectorAll('[data-count-to]'));
    if (this.counters.length === 0) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      for (const el of this.counters) this.write(el, this.targetOf(el));
      return;
    }

    this.observer = new IntersectionObserver((entries) => this.onIntersect(entries), {
      threshold: 0.4,
    });
    for (const el of this.counters) this.observer.observe(el);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  /** @param {IntersectionObserverEntry[]} entries */
  onIntersect(entries) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      this.animate(/** @type {HTMLElement} */ (entry.target));
      this.observer?.unobserve(entry.target);
    }
  }

  /** @param {HTMLElement} el @returns {number} */
  targetOf(el) {
    return Number(el.dataset.countTo) || 0;
  }

  /** @param {HTMLElement} el */
  animate(el) {
    const target = this.targetOf(el);
    const decimals = (el.dataset.countTo || '').includes('.') ? 1 : 0;
    const duration = 1400;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.write(el, target * eased, decimals);
      if (progress < 1) requestAnimationFrame(tick);
      else this.write(el, target, decimals);
    };

    requestAnimationFrame(tick);
  }

  /** @param {HTMLElement} el @param {number} value @param {number} [decimals] */
  write(el, value, decimals = 0) {
    el.textContent = value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
}

if (!customElements.get('stats-counter')) {
  customElements.define('stats-counter', StatsCounter);
}
