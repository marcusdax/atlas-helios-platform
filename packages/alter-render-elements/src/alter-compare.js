/**
 * <alter-compare> - before/after reveal slider.
 *
 * Built as a custom element rather than a React component on purpose. The
 * comparison slider is the piece every host wants, and hosts are not all React:
 * this same file works in React, Vue, Svelte, Angular, Astro, a Rails ERB
 * template, a WordPress block, or a plain <script type="module"> page. Shadow
 * DOM keeps the host's CSS out and this element's CSS in, which is what makes
 * "drop it into another platform" survive contact with someone else's reset.
 *
 * Behaviour notes, all of them fixes for real defects in the prototype this
 * replaces:
 *  - Pointer Events with pointer capture, so a drag that leaves the element
 *    keeps tracking instead of silently stopping.
 *  - Keyboard operable and exposed as role="slider", so it is usable without a
 *    mouse and announced correctly by screen readers.
 *  - The two images are laid out identically and the top one is clipped, never
 *    resized, so the seam stays pixel-aligned at every position.
 *
 * Attributes / properties
 *   before, after      - image URLs (data: URLs welcome)
 *   position           - 0-100, reflected, defaults to 50
 *   label-before, label-after
 *   orientation        - "horizontal" (default) | "vertical"
 *   fit                - "cover" (default) | "contain"
 *   loading            - boolean, shows the working state
 *   disabled           - boolean, freezes interaction
 *
 * Events
 *   input  - fires continuously while dragging   (detail: { position })
 *   change - fires when a drag or key press ends (detail: { position })
 *
 * Theming (CSS custom properties, all optional)
 *   --alter-radius, --alter-aspect, --alter-surface, --alter-accent,
 *   --alter-handle-size, --alter-seam-width, --alter-label-bg, --alter-label-fg
 */

const TEMPLATE = `
<style>
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    border-radius: var(--alter-radius, 12px);
    aspect-ratio: var(--alter-aspect, 4 / 3);
    background: var(--alter-surface, #101418);
    color: var(--alter-label-fg, #f6f8fa);
    contain: layout paint;
    touch-action: none;            /* we own the gesture; stop the page scrolling under it */
    user-select: none;
    -webkit-user-select: none;
  }
  :host([hidden]) { display: none; }
  :host(:focus-visible) {
    outline: 2px solid var(--alter-accent, #38bdf8);
    outline-offset: 2px;
  }
  :host([disabled]) { cursor: default; }

  .layer {
    position: absolute;
    inset: 0;
  }
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: var(--alter-fit, cover);
    display: block;
    -webkit-user-drag: none;
    user-select: none;
    pointer-events: none;
  }
  /* The reveal layer is full-size and clipped. Clipping (not resizing) is what
     keeps the two photographs registered to each other at the seam. */
  .after {
    clip-path: inset(0 var(--clip-right, 50%) 0 0);
  }
  :host([orientation="vertical"]) .after {
    clip-path: inset(0 0 var(--clip-bottom, 50%) 0);
  }

  .seam {
    position: absolute;
    top: 0;
    bottom: 0;
    width: var(--alter-seam-width, 2px);
    margin-left: calc(var(--alter-seam-width, 2px) / -2);
    background: #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, .25), 0 0 12px rgba(0, 0, 0, .45);
    pointer-events: none;
  }
  :host([orientation="vertical"]) .seam {
    top: auto;
    left: 0;
    right: 0;
    bottom: auto;
    width: auto;
    height: var(--alter-seam-width, 2px);
    margin-left: 0;
    margin-top: calc(var(--alter-seam-width, 2px) / -2);
  }

  .handle {
    position: absolute;
    width: var(--alter-handle-size, 40px);
    height: var(--alter-handle-size, 40px);
    border-radius: 50%;
    background: #fff;
    color: #1f2937;
    display: grid;
    place-items: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, .35);
    pointer-events: none;
    transform: translate(-50%, -50%);
    transition: transform .12s ease;
  }
  :host(:hover) .handle,
  :host(:focus-visible) .handle { transform: translate(-50%, -50%) scale(1.08); }
  :host([orientation="vertical"]) .handle svg { rotate: 90deg; }

  .label {
    position: absolute;
    top: 12px;
    padding: 4px 10px;
    border-radius: 6px;
    font: 600 12px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    letter-spacing: .02em;
    background: var(--alter-label-bg, rgba(8, 12, 16, .66));
    color: var(--alter-label-fg, #f6f8fa);
    backdrop-filter: blur(6px);
    pointer-events: none;
  }
  .label.before { left: 12px; }
  .label.after  { right: 12px; background: var(--alter-accent, #0ea5e9); color: #04121c; }

  .state {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    gap: 12px;
    grid-auto-flow: row;
    align-content: center;
    text-align: center;
    padding: 24px;
    font: 500 13px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: color-mix(in srgb, var(--alter-label-fg, #f6f8fa) 70%, transparent);
    background: var(--alter-surface, #101418);
  }
  .spinner {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 3px solid color-mix(in srgb, var(--alter-accent, #38bdf8) 25%, transparent);
    border-top-color: var(--alter-accent, #38bdf8);
    animation: spin 900ms linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (prefers-reduced-motion: reduce) {
    .spinner { animation-duration: 2.4s; }
    .handle  { transition: none; }
  }
  @media (forced-colors: active) {
    .seam, .handle { forced-color-adjust: none; background: CanvasText; }
    .handle { color: Canvas; }
  }
</style>

<div class="layer before-layer" part="before-layer"><img class="before-img" alt="" decoding="async"></div>
<div class="layer after" part="after-layer"><img class="after-img" alt="" decoding="async"></div>
<div class="seam" part="seam"></div>
<div class="handle" part="handle" aria-hidden="true">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
       stroke-linecap="round" stroke-linejoin="round"><path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>
</div>
<div class="state" part="state" hidden></div>
`;

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const bool = (element, name) => element.hasAttribute(name);

export class AlterCompare extends HTMLElement {
  static observedAttributes = ['before', 'after', 'position', 'label-before', 'label-after', 'orientation', 'fit', 'loading', 'disabled'];

  #root;
  #position = 50;
  #dragging = false;
  #dragStart = 50;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.innerHTML = TEMPLATE;

    this.addEventListener('pointerdown', this.#onPointerDown);
    this.addEventListener('pointermove', this.#onPointerMove);
    this.addEventListener('pointerup', this.#onPointerUp);
    this.addEventListener('pointercancel', this.#onPointerUp);
    this.addEventListener('keydown', this.#onKeyDown);
    this.addEventListener('dblclick', this.#onDoubleClick);
  }

  connectedCallback() {
    // Only claim the a11y role once both images exist; an empty placeholder is
    // not a slider and should not be announced or focusable as one.
    this.#syncAll();
  }

  attributeChangedCallback(name, previous, next) {
    if (previous === next) return;
    if (name === 'position') {
      const parsed = Number.parseFloat(next);
      if (Number.isFinite(parsed)) this.#position = clamp(parsed);
    }
    this.#syncAll();
  }

  /* ---- properties (so frameworks can bind objects/numbers, not just strings) ---- */

  get before() { return this.getAttribute('before') || ''; }
  set before(value) { value == null ? this.removeAttribute('before') : this.setAttribute('before', value); }

  get after() { return this.getAttribute('after') || ''; }
  set after(value) { value == null ? this.removeAttribute('after') : this.setAttribute('after', value); }

  get position() { return this.#position; }
  set position(value) {
    const next = clamp(Number.parseFloat(value));
    if (!Number.isFinite(next) || next === this.#position) return;
    this.#position = next;
    this.setAttribute('position', String(next));
  }

  get loading() { return bool(this, 'loading'); }
  set loading(value) { this.toggleAttribute('loading', Boolean(value)); }

  get disabled() { return bool(this, 'disabled'); }
  set disabled(value) { this.toggleAttribute('disabled', Boolean(value)); }

  get vertical() { return this.getAttribute('orientation') === 'vertical'; }

  /** Both images present is the only state in which the control is meaningful. */
  get #ready() { return Boolean(this.before && this.after); }

  /* ---- interaction ---- */

  #positionFromEvent(event) {
    const rect = this.getBoundingClientRect();
    if (this.vertical) {
      if (rect.height === 0) return this.#position;
      return clamp(((event.clientY - rect.top) / rect.height) * 100);
    }
    if (rect.width === 0) return this.#position;
    const ratio = (event.clientX - rect.left) / rect.width;
    // Mirror the axis under RTL so the handle tracks the pointer, not the LTR
    // coordinate space.
    const rtl = getComputedStyle(this).direction === 'rtl';
    return clamp((rtl ? 1 - ratio : ratio) * 100);
  }

  #onPointerDown = (event) => {
    if (!this.#ready || this.disabled) return;
    this.#dragging = true;
    this.#dragStart = this.#position;
    // Capture means the drag survives leaving the element, and means we get the
    // pointerup even if the release happens over another element entirely.
    this.setPointerCapture?.(event.pointerId);
    this.focus({ preventScroll: true });
    this.#commit(this.#positionFromEvent(event), 'input');
    event.preventDefault();
  };

  #onPointerMove = (event) => {
    if (!this.#dragging) return;
    this.#commit(this.#positionFromEvent(event), 'input');
  };

  #onPointerUp = (event) => {
    if (!this.#dragging) return;
    this.#dragging = false;
    this.releasePointerCapture?.(event.pointerId);
    if (this.#position !== this.#dragStart) this.#emit('change');
  };

  #onDoubleClick = () => {
    if (!this.#ready || this.disabled) return;
    this.#commit(50, 'input');
    this.#emit('change');
  };

  #onKeyDown = (event) => {
    if (!this.#ready || this.disabled) return;
    const coarse = event.shiftKey ? 10 : 1;
    const map = {
      ArrowLeft: -coarse, ArrowDown: -coarse, PageDown: -10,
      ArrowRight: coarse, ArrowUp: coarse, PageUp: 10,
      Home: -Infinity, End: Infinity
    };
    const delta = map[event.key];
    if (delta === undefined) return;

    event.preventDefault();
    const next = delta === -Infinity ? 0 : delta === Infinity ? 100 : this.#position + delta;
    this.#commit(next, 'input');
    this.#emit('change');
  };

  #commit(next, eventName) {
    const value = clamp(next);
    if (value === this.#position) return;
    this.#position = value;
    this.setAttribute('position', String(Math.round(value * 100) / 100));
    if (eventName) this.#emit(eventName);
  }

  #emit(type) {
    // composed:true so the event escapes the shadow boundary and a host
    // framework's normal listener syntax picks it up.
    this.dispatchEvent(new CustomEvent(type, {
      detail: { position: this.#position },
      bubbles: true,
      composed: true
    }));
  }

  /* ---- rendering ---- */

  #syncAll() {
    const root = this.#root;
    if (!root) return;

    const beforeImg = root.querySelector('.before-img');
    const afterImg = root.querySelector('.after-img');
    const state = root.querySelector('.state');
    const seam = root.querySelector('.seam');
    const handle = root.querySelector('.handle');

    const beforeSrc = this.before;
    const afterSrc = this.after;
    const labelBefore = this.getAttribute('label-before') || 'Before';
    const labelAfter = this.getAttribute('label-after') || 'After';

    if (beforeImg.getAttribute('src') !== beforeSrc) {
      beforeSrc ? beforeImg.setAttribute('src', beforeSrc) : beforeImg.removeAttribute('src');
      beforeImg.alt = beforeSrc ? `${labelBefore}: original property photograph` : '';
    }
    if (afterImg.getAttribute('src') !== afterSrc) {
      afterSrc ? afterImg.setAttribute('src', afterSrc) : afterImg.removeAttribute('src');
      afterImg.alt = afterSrc ? `${labelAfter}: rendered improvement` : '';
    }

    this.style.setProperty('--alter-fit', this.getAttribute('fit') === 'contain' ? 'contain' : 'cover');

    // Clip from the trailing edge, so `position` reads as "how much of the
    // after image is revealed".
    const remainder = `${100 - this.#position}%`;
    this.style.setProperty(this.vertical ? '--clip-bottom' : '--clip-right', remainder);

    const offset = `${this.#position}%`;
    if (this.vertical) {
      seam.style.top = offset;
      seam.style.left = '';
      handle.style.top = offset;
      handle.style.left = '50%';
    } else {
      seam.style.left = offset;
      seam.style.top = '';
      handle.style.left = offset;
      handle.style.top = '50%';
    }

    this.#syncLabels(labelBefore, labelAfter);
    this.#syncState(state);
    this.#syncA11y();
  }

  #syncLabels(labelBefore, labelAfter) {
    const root = this.#root;
    const show = this.#ready && !this.loading;
    for (const [side, text] of [['before', labelBefore], ['after', labelAfter]]) {
      let node = root.querySelector(`.label.${side}`);
      if (!show) { node?.remove(); continue; }
      if (!node) {
        node = document.createElement('div');
        node.className = `label ${side}`;
        node.setAttribute('part', `label label-${side}`);
        root.appendChild(node);
      }
      if (node.textContent !== text) node.textContent = text;
    }
  }

  #syncState(state) {
    const root = this.#root;
    const seam = root.querySelector('.seam');
    const handle = root.querySelector('.handle');

    if (this.loading) {
      state.hidden = false;
      state.innerHTML = '<div class="spinner"></div><div>Rendering the improvement…</div>';
      state.setAttribute('role', 'status');
    } else if (!this.#ready) {
      state.hidden = false;
      state.removeAttribute('role');
      state.textContent = this.before
        ? 'Waiting for the rendered result'
        : 'Add a property photo to begin';
    } else {
      state.hidden = true;
      state.textContent = '';
    }

    // The before image should still show underneath while the after renders.
    if (this.loading && this.before) state.style.background = 'color-mix(in srgb, var(--alter-surface, #101418) 78%, transparent)';
    else state.style.background = '';

    const interactive = this.#ready && !this.loading;
    seam.hidden = !interactive;
    handle.hidden = !interactive;
  }

  #syncA11y() {
    const interactive = this.#ready && !this.loading && !this.disabled;
    if (interactive) {
      this.setAttribute('role', 'slider');
      this.setAttribute('tabindex', '0');
      this.setAttribute('aria-valuemin', '0');
      this.setAttribute('aria-valuemax', '100');
      this.setAttribute('aria-valuenow', String(Math.round(this.#position)));
      this.setAttribute('aria-valuetext', `${Math.round(this.#position)}% of the rendered result revealed`);
      this.setAttribute('aria-orientation', this.vertical ? 'vertical' : 'horizontal');
      if (!this.hasAttribute('aria-label')) {
        this.setAttribute('aria-label', 'Before and after comparison');
      }
    } else {
      // A placeholder is not a control: drop the role so assistive tech does
      // not offer a slider that does nothing.
      this.removeAttribute('role');
      this.removeAttribute('tabindex');
      for (const attr of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-orientation']) {
        this.removeAttribute(attr);
      }
    }
  }
}

// Guard the registration: bundlers and micro-frontends load modules more than
// once, and a duplicate define() is a hard throw that takes the page with it.
if (typeof customElements !== 'undefined' && !customElements.get('alter-compare')) {
  customElements.define('alter-compare', AlterCompare);
}

export default AlterCompare;
