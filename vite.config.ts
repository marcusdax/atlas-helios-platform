import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Cesium is imported as a module, but we need to treat it as external for some bundlers
      // 'cesium': path.resolve(__dirname, './node_modules/cesium/Build/Cesium/Cesium.js'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3004',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      // Treat cesium as external if needed, but we can also try to bundle it
      // For simplicity, we'll not mark as external and try to bundle
      // However, Cesium is large and may cause issues; we'll see.
      // external: ['cesium']
    },
  },
  define: {
    // Cesium expects a global variable `global` or `globalThis`
    global: 'globalThis',
  },
  // Optimize deps: exclude cesium from optimization if needed
  optimizeDeps: {
    exclude: ['cesium'],
  },
})
