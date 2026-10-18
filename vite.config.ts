import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import pkg from './package.json' with { type: 'json' };

const appVersion = pkg.version || '1.1.0';
const buildTime = new Date().toISOString();

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    {
      name: 'generate-version-json',
      buildStart() {
        const versionData = {
          version: appVersion,
          buildTime: buildTime,
        };
        const publicDir = path.resolve(__dirname, 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        fs.writeFileSync(
          path.resolve(publicDir, 'version.json'),
          JSON.stringify(versionData, null, 2)
        );
      },
    },
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
        // Activate new SW immediately — don't wait for all tabs to close
        skipWaiting: true,
        clientsClaim: true,
        // Cache the app shell (HTML, JS, CSS, fonts)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Raise limit to 4 MiB — the main bundle is ~2.16 MB
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // API requests: never cache via SW — we handle offline via IndexedDB
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // version.json MUST never be cached so auto-update checks always get fresh data
            urlPattern: /\/version\.json$/,
            handler: 'NetworkOnly',
          },
          {
            // JS/CSS: NetworkFirst so new deploys are picked up immediately
            urlPattern: /\.(?:js|css)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'js-css-assets',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 24 * 60 * 60, // 1 day fallback
              },
            },
          },
          {
            // Images/fonts: CacheFirst — they don't change between deploys
            urlPattern: /\.(?:png|ico|svg|woff2)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
});

