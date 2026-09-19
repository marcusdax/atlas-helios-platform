/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        // Mirrors the custom properties already in index.css, so utility
        // classes and hand-written CSS cannot drift into two palettes.
        atlas: { 100: '#CCE5FF', 500: '#007AFF', 700: '#0056B3' }
      }
    }
  },
  plugins: []
};
