import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// base: './' — относительные пути, чтобы сборка работала на GitHub Pages
// по адресу https://<user>.github.io/<repo>/ без хардкода имени репозитория.
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Время подлёта',
        short_name: 'Подлёт',
        description: 'Время полёта ракеты или дрона между населёнными пунктами Украины при максимальной скорости',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1f5fbf',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Справочник пунктов (~2 МБ) кешируем целиком — приложение работает офлайн.
        // ttf/eot иконочного шрифта не берём: современным браузерам хватает woff2.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Шрифт иконок MDI запрашивается как ...woff2?v=7.4.47 — игнорируем ?v, иначе офлайн не найдёт его в кеше.
        ignoreURLParametersMatching: [/^v$/, /^utm_/],
      },
    }),
  ],
})
