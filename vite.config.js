import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  build: {
    // Warnung bei großen Chunks erhöhen — die App hat viele Libraries
    chunkSizeWarningLimit: 1200,
    // Rollup-Optionen für besseres Code-Splitting
    rollupOptions: {
      output: {
        // Vendor-Chunks manuell aufteilen für besseres Caching
        manualChunks: {
          // React Core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Leaflet + React-Leaflet (große Library)
          'leaflet-vendor': ['leaflet', 'react-leaflet'],
          // UI-Komponenten (Radix + Lucide)
          'ui-vendor': ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-select', '@radix-ui/react-dropdown-menu'],
          // Charts
          'chart-vendor': ['recharts'],
          // PDF-Generierung
          'pdf-vendor': ['jspdf', 'html2canvas'],
          // Drag & Drop
          'dnd-vendor': ['@hello-pangea/dnd'],
          // Markdown & Quill Editor
          'editor-vendor': ['react-markdown', 'react-quill'],
          // 3D
          'three-vendor': ['three'],
        },
      },
    },
    // CSS-Code-Splitting
    cssCodeSplit: true,
    // Source Maps nur in Entwicklung
    sourcemap: false,
    // Minify mit esbuild (schneller als terser)
    minify: 'esbuild',
    // Target auf moderne Browser
    target: 'es2020',
  },
  // Esbuild-Optionen für schnellere Builds
  esbuild: {
    drop: ['console', 'debugger'],
  },
});