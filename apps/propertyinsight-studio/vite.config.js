import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const API_PORT = process.env.PORT || 5175;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The API runs as a separate process in dev so the browser talks to the
    // same relative /api paths it will use in production.
    proxy: { '/api': `http://127.0.0.1:${API_PORT}` },
    fs: {
      // The @alter/* packages are file: links to ../../packages, which resolve
      // outside this app's root once symlinks are followed.
      allow: [root, path.resolve(root, '../../packages')]
    }
  },
  optimizeDeps: {
    // render-core is CommonJS; prebundling converts it once in dev instead of
    // on every request. The other two are ESM and need no interop.
    include: ['@alter/render-core']
  },
  resolve: {
    // Resolve the file: links to their real paths so one copy of each package
    // is bundled, not one per import specifier.
    preserveSymlinks: false
  },
  build: {
    commonjsOptions: {
      // @alter/render-core is CommonJS. Installed from a registry it sits in
      // node_modules and Rollup's commonjs plugin picks it up by default; here
      // it is a file: link that resolves to ../../packages, outside that
      // default include, so named imports would fail to bind at build time.
      include: [/node_modules/, /packages[\\/]alter-render-core/]
    },
    outDir: 'dist',
    sourcemap: true,
    // A rendered data: URL is large; keep chunks readable rather than warning.
    chunkSizeWarningLimit: 900
  }
});
