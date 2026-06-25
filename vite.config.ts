import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: 'inline',
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'RetailSuite',
        short_name: 'RetailSuite',
        description: 'RetailSuite — Sales & Inventory Management',
        theme_color: '#0ea5e9',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        // Cache the app shell (HTML, JS, CSS, fonts)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Raise limit to 4 MiB — the main bundle is ~2.16 MB
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // API requests: never cache via SW — we handle offline via IndexedDB
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Static assets — serve from cache, update in background
            urlPattern: /^(?!.*\/api\/).*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
});

