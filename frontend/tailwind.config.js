/**
 * Tailwind, pointed at the AUCTUM engine palette.
 *
 * The product is written almost entirely in utility classes — 423 `neutral-*`
 * alone — so the palette is changed here rather than in four hundred files.
 * Each scale below is redefined to an engine ramp, which means an existing
 * `bg-neutral-900` now paints the engine's panel surface and an existing
 * `text-emerald-400` now paints proof green.
 *
 * Per 01 — Brand architecture §5, the market accent (Atlas amber) is brand
 * chrome and "never appears inside a tool's controls". The scales the product
 * uses for buttons, links and focus rings therefore resolve to BRASS, which is
 * engine palette and market-independent. Atlas amber is exposed only as
 * `brand-*`, for the masthead and sign-in chrome.
 *
 * @type {import('tailwindcss').Config}
 */

// The engine's ten values, plus the interpolated steps a utility scale needs.
// Interpolations stay on the ink→ivory line so nothing drifts off-palette.
const ink = {
  950: '#0A0D11',
  900: '#11161C',
  850: '#151B22',
  800: '#182028',
  700: '#222A33',
  600: '#34404D',
  500: '#4A5765',
  400: '#6B7785',
  300: '#9AA4AE',
  200: '#BFC6CD',
  100: '#DCE0E4',
  50: '#F6F1E7'
};

// Brass, the in-tool action colour. 8.09:1 on the canvas at its base step.
const brass = {
  950: '#2A1F0E',
  900: '#43331A',
  800: '#5C4724',
  700: '#7D6032',
  600: '#A07C41',
  500: '#C9A15A',
  400: '#D4B176',
  300: '#DFC494',
  200: '#E9D7B4',
  100: '#F2E7D3',
  50: '#FAF5EC'
};

const proof = {
  900: '#0F2C23',
  800: '#174536',
  700: '#1F5E49',
  600: '#27755C',
  500: '#2E8B6B',
  400: '#46A585',
  300: '#6FBFA3',
  200: '#A1D7C4',
  100: '#CCEADF',
  50: '#E9F5F0'
};

const alert = {
  900: '#3A1312',
  800: '#59201E',
  700: '#7C2E2B',
  600: '#A93E3A',
  500: '#D9534F',
  400: '#E3736F',
  300: '#EC9693',
  200: '#F3BCBA',
  100: '#F9DCDB',
  50: '#FDF0EF'
};

const atlas = {
  900: '#3D2710',
  700: '#8A5A26',
  600: '#AE7332',
  500: '#D08A3E',
  400: '#DBA165',
  300: '#E5BA8D',
  100: '#F6E6D4'
};

module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      colors: {
        // Surfaces and text. `gray` and `slate` are aliased so a stray class
        // from either family cannot reintroduce an off-palette grey.
        neutral: ink,
        gray: ink,
        slate: ink,

        // In-tool action. The product writes buttons and links as sky/blue, so
        // those resolve to brass rather than to the market accent.
        brass,
        sky: brass,
        blue: brass,
        amber: brass,
        yellow: brass,
        orange: brass,

        // Met evidence.
        proof,
        emerald: proof,
        green: proof,

        // Risk.
        alert,
        red: alert,
        rose: alert,

        // Five stray purple/violet classes remained after the families above
        // were mapped. They are folded into brass rather than left as the one
        // hue on screen that belongs to no token — the engine palette has no
        // purple, so anything rendering purple is by definition off-brand.
        purple: brass,
        violet: brass,
        indigo: brass,
        fuchsia: brass,
        pink: alert,
        teal: proof,
        cyan: brass,
        lime: proof,
        stone: ink,
        zinc: ink,

        // Brand chrome only. Never a control — see §5.
        brand: atlas,
        atlas
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.22, 1, 0.36, 1)'
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '320ms'
      }
    }
  },
  plugins: []
};
