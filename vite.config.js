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
        // Funktions-Form: erfasst zuverlässig ALLE Subpath-Imports (react/jsx-runtime,
        // react-dom/client, scheduler) — die Objekt-Form verpasst diese und erzeugt
        // zirkuläre Abhängigkeiten zwischen React Core und React DOM Chunks.
        manualChunks(id) {
          // React Core + DOM + scheduler MÜSSEN im selben Chunk sein (zirkuläre Abhängigkeit)
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/') ||
              id.includes('node_modules/react-router-dom')) {
            return 'react-vendor';
          }
          // Leaflet + React-Leaflet (große Library)
          if (id.includes('node_modules/leaflet') ||
              id.includes('node_modules/react-leaflet')) {
            return 'leaflet-vendor';
          }
          // UI-Komponenten (Radix + Lucide)
          if (id.includes('node_modules/lucide-react') ||
              id.includes('node_modules/@radix-ui/react-dialog') ||
              id.includes('node_modules/@radix-ui/react-popover') ||
              id.includes('node_modules/@radix-ui/react-select') ||
              id.includes('node_modules/@radix-ui/react-dropdown-menu')) {
            return 'ui-vendor';
          }
          // Charts
          if (id.includes('node_modules/recharts')) {
            return 'chart-vendor';
          }
          // PDF-Generierung
          if (id.includes('node_modules/jspdf') ||
              id.includes('node_modules/html2canvas')) {
            return 'pdf-vendor';
          }
          // Drag & Drop
          if (id.includes('node_modules/@hello-pangea/dnd')) {
            return 'dnd-vendor';
          }
          // Markdown & Quill Editor
          if (id.includes('node_modules/react-markdown') ||
              id.includes('node_modules/react-quill')) {
            return 'editor-vendor';
          }
          // 3D
          if (id.includes('node_modules/three')) {
            return 'three-vendor';
          }
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