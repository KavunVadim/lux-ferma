import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Відносний base: один і той самий білд працює і на вебі (в т.ч. у підкаталозі),
  // і всередині Capacitor WebView.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Люкс Ферма — помічник для гри',
        short_name: 'Люкс Ферма',
        description:
          'Помічник для настільної гри «Люкс Ферма»: кубики, розмноження тварин, хижаки та обмін — на одному пристрої.',
        lang: 'uk',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#FAF3E0',
        theme_color: '#4B7F52',
        icons: [
          { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,webp,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
