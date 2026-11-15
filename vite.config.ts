import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'HoldPoint by CodeVolve',
        short_name: 'HoldPoint',
        description: 'ITP-driven QA forms, sign-off and approval for field coatings work',
        theme_color: '#15181C',
        background_color: '#F4F5F2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Company PDF filling (pdf-lib + fontkit, ~1 MB) is engineer-only and online-only: don't make every phone download it.
        globIgnores: ['**/pdfForm-*.js']
      }
    })
  ],
  server: { host: true }
});
