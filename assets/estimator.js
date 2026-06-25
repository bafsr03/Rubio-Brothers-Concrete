import { Component } from '@theme/component';

/**
 * Concrete cost estimator + lead capture.
 *
 * Formula (Rubio Brothers):
 *   yards    = ceil(sqft / sqftPerYard)              (1 cubic yard ≈ 80 sq ft)
 *   concrete = yards < smallLoadThreshold ? smallLoadFee : yards * yardRate
 *   rough    = (concrete + addOn) * multiplier
 *
 * yardRate is pump-dependent (high) / no-pump (low) / "not sure" (mid). The
 * shown figure is a rounded ± range, never an exact promise — the lead form
 * captures the visitor so the owner can confirm an exact price.
 *
 * Progressive enhancement: the lead form is visible by default (no-JS), and is
 * collapsed until a valid estimate exists once JS runs (`estimator--js`).
 *
 * @typedef {object} EstimatorRefs
 * @property {HTMLInputElement} sqft
 * @property {HTMLInputElement} sqftRange
 * @property {HTMLSelectElement} [jobType]
 * @property {HTMLSelectElement} pump
 * @property {HTMLElement} result
 * @property {HTMLElement} placeholder
 * @property {HTMLElement} lowOut
 * @property {HTMLElement} highOut
 * @property {HTMLElement} yardsOut
 * @property {HTMLInputElement} [fieldJobType]
 * @property {HTMLInputElement} [fieldSqft]
 * @property {HTMLInputElement} [fieldYards]
 * @property {HTMLInputElement} [fieldEstimate]
 * @property {HTMLTextAreaElement} [body]
 *
 * @extends {Component<EstimatorRefs>}
 */
export class ConcreteEstimator extends Component {
  requiredRefs = ['sqft', 'sqftRange', 'pump', 'result', 'placeholder', 'lowOut', 'highOut', 'yardsOut'];

  connectedCallback() {
    super.connectedCallback();

    const d = this.dataset;
    this.config = {
      sqftPerYard: Number(d.sqftPerYard) || 80,
      rateLow: Number(d.rateLow) || 230,
      rateHigh: Number(d.rateHigh) || 260,
      rateMid: Number(d.rateMid) || 250,
      smallLoadFee: Number(d.smallLoadFee) || 350,
      smallLoadThreshold: Number(d.smallLoadThreshold) || 5,
      addOn: Number(d.addOn) || 350,
      multiplier: Number(d.multiplier) || 3,
      rangePct: Number(d.rangePct) || 10,
      maxSqft: Number(d.maxSqft) || 10000,
      currency: d.currency || 'USD',
    };

    this.formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: this.config.currency,
      maximumFractionDigits: 0,
    });

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Enables the progressive-reveal CSS (form hidden until an estimate exists).
    this.classList.add('estimator--js');
    // Keep the form visible if the server round-tripped a success/error state.
    if (this.querySelector('.estimator__success, .estimator__error')) {
      this.classList.add('estimator--show-form');
    }

    this.calculate();
  }

  /** @returns {number} per-cubic-yard concrete rate based on the pump answer */
  get yardRate() {
    switch (this.refs.pump.value) {
      case 'yes':
        return this.config.rateHigh;
      case 'no':
        return this.config.rateLow;
      default:
        return this.config.rateMid;
    }
  }

  /** Read + clamp the square footage from the number input. */
  readSqft() {
    let n = Math.floor(Number(this.refs.sqft.value) || 0);
    if (n < 0) n = 0;
    if (n > this.config.maxSqft) n = this.config.maxSqft;
    return n;
  }

  /** Number input changed → clamp, mirror to slider, recompute. */
  onNumberInput() {
    const n = this.readSqft();
    if (this.refs.sqft.value !== '' && String(n) !== this.refs.sqft.value) {
      this.refs.sqft.value = String(n);
    }
    this.syncSlider(n);
    this.clearActiveChip();
    this.calculate();
  }

  /** Slider moved → mirror to number input, recompute. */
  onSliderInput() {
    const n = Math.floor(Number(this.refs.sqftRange.value) || 0);
    this.refs.sqft.value = String(n);
    this.clearActiveChip();
    this.calculate();
  }

  /** @param {number} n */
  syncSlider(n) {
    const max = Number(this.refs.sqftRange.max) || 2500;
    this.refs.sqftRange.value = String(Math.min(Math.max(n, 0), max));
  }

  /**
   * Quick-pick preset chip clicked.
   * @param {Event} event
   */
  applyPreset(event) {
    const el = /** @type {HTMLElement} */ (event.target)?.closest?.('[data-sqft]');
    if (!el) return;

    const n = Math.floor(Number(el.dataset.sqft) || 0);
    this.refs.sqft.value = String(n);
    this.syncSlider(n);

    const job = el.dataset.job;
    if (job && this.refs.jobType) {
      const opt = Array.from(this.refs.jobType.options).find(
        (o) => o.value.toLowerCase() === job.toLowerCase()
      );
      if (opt) this.refs.jobType.value = opt.value;
    }

    this.setActiveChip(el);
    this.calculate();
  }

  /** @param {HTMLElement} active */
  setActiveChip(active) {
    for (const chip of this.querySelectorAll('[data-sqft]')) {
      chip.setAttribute('aria-pressed', chip === active ? 'true' : 'false');
    }
  }

  clearActiveChip() {
    for (const chip of this.querySelectorAll('[data-sqft]')) chip.setAttribute('aria-pressed', 'false');
  }

  /** Recompute the estimate. */
  calculate() {
    const sqft = this.readSqft();

    if (sqft <= 0) {
      this.showPlaceholder();
      return;
    }

    const { sqftPerYard, smallLoadThreshold, smallLoadFee, addOn, multiplier, rangePct } = this.config;

    const yards = Math.max(1, Math.ceil(sqft / sqftPerYard));
    const concrete = yards < smallLoadThreshold ? smallLoadFee : yards * this.yardRate;
    const rough = (concrete + addOn) * multiplier;

    const step = rough >= 20000 ? 100 : 50;
    const low = roundTo(rough * (1 - rangePct / 100), step);
    const high = roundTo(rough * (1 + rangePct / 100), step);

    this.current = { sqft, yards, rough, low, high };

    this.render();
    this.syncFormFields();
  }

  showPlaceholder() {
    this.current = null;
    this.refs.placeholder.hidden = false;
    this.refs.result.hidden = true;
    this.classList.remove('estimator--has-result');
    this.syncFormFields();
  }

  render() {
    const { yards, low, high } = this.current;

    this.refs.placeholder.hidden = true;
    this.refs.result.hidden = false;
    this.classList.add('estimator--has-result');

    this.refs.yardsOut.textContent = String(yards);
    this.animateMoney(this.refs.lowOut, low);
    this.animateMoney(this.refs.highOut, high);
  }

  /**
   * Count a money figure up to its value.
   * @param {HTMLElement} el
   * @param {number} value
   */
  animateMoney(el, value) {
    const from = Number(el.dataset.value) || 0;
    el.dataset.value = String(value);

    if (this.prefersReducedMotion || from === value) {
      el.textContent = this.formatter.format(value);
      return;
    }

    const duration = 600;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round((from + (value - from) * eased) / 50) * 50;
      el.textContent = this.formatter.format(current);
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = this.formatter.format(value);
    };

    requestAnimationFrame(tick);
  }

  /** Keep the hidden contact-form fields in sync so the lead email carries the estimate. */
  syncFormFields() {
    const { fieldJobType, fieldSqft, fieldYards, fieldEstimate, body, jobType } = this.refs;
    const jobLabel = jobType ? jobType.options[jobType.selectedIndex]?.text ?? jobType.value : '';

    if (fieldJobType) fieldJobType.value = jobLabel;

    if (!this.current) {
      if (fieldSqft) fieldSqft.value = '';
      if (fieldYards) fieldYards.value = '';
      if (fieldEstimate) fieldEstimate.value = '';
      return;
    }

    const { sqft, yards, low, high } = this.current;
    const range = `${this.formatter.format(low)} – ${this.formatter.format(high)}`;

    if (fieldSqft) fieldSqft.value = `${sqft} sq ft`;
    if (fieldYards) fieldYards.value = `${yards} cubic yards`;
    if (fieldEstimate) fieldEstimate.value = range;

    if (body && !body.dataset.touched) {
      body.value =
        `I'd like a detailed quote for a ${jobLabel || 'concrete'} project.\n` +
        `Approx. size: ${sqft} sq ft (~${yards} cubic yards).\n` +
        `Online rough estimate: ${range}.`;
    }
  }

  /** Mark the message as user-edited so we stop overwriting it. */
  markBodyTouched() {
    if (this.refs.body) this.refs.body.dataset.touched = 'true';
  }
}

/**
 * Round to the nearest step.
 * @param {number} value
 * @param {number} step
 * @returns {number}
 */
function roundTo(value, step) {
  return Math.round(value / step) * step;
}

if (!customElements.get('concrete-estimator')) {
  customElements.define('concrete-estimator', ConcreteEstimator);
}
