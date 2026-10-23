import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        id: 'shix-terminal',
        name: 'ShiX Terminal',
        short_name: 'ShiX',
        description: 'Simulasi terminal trade markets: crypto, memecoin, shitcoin launchpad, saham, forex, komoditas.',
        lang: 'id',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#07090f',
        theme_color: '#07090f',
        categories: ['games', 'finance', 'entertainment'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,ico}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html'
      },
      devOptions: { enabled: false }
    })
  ],
  server: { host: true, port: 5173, strictPort: false },
  preview: { host: true, port: 4173, strictPort: false }
});
