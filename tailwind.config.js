/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* AUCTUM — The Archival Ledger / Museum Folio (mirrored from auctum.coffee) */
        parchment: "var(--parchment)",
        "parchment-deep": "var(--parchment-deep)",
        ink: "var(--ink)",
        navy: "var(--navy)",
        oxblood: "var(--oxblood)",
        sage: "var(--sage)",
        slate: {
          DEFAULT: "var(--slate)",
          950: '#17231D',
          900: '#1F2E33',
          800: '#2A3B40',
          700: '#3D4F54',
          600: '#526055',
          500: '#536056',
          400: '#88998C',
          300: '#D5DAC6',
          200: '#E5E8DC',
          100: '#F1F2EA',
        },
        gold: "var(--gold)",
        vanguard: "var(--c-vanguard)",
        helios: "var(--c-helios)",
        atlas: "var(--c-atlas)",
        prospect: "var(--c-prospect)",
        trust: "var(--c-trust)",
        "status-verified": "var(--status-verified)",
        "status-review": "var(--status-review)",
        "status-flagged": "var(--status-flagged)",
        cyan: {
          400: '#8C2F22',
          500: '#8C2F22',
          600: '#6E2318',
        },
        amber: {
          400: '#6D592D',
          500: '#7E5415',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        xl: '2px',
        lg: '2px',
        md: '2px',
        sm: '2px',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'seal-spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        marquee: 'marquee 32s linear infinite',
        'seal-spin': 'seal-spin 60s linear infinite',
        'seal-spin-fast': 'seal-spin 8s linear infinite',
      },
    },
  },
  plugins: [],
}
