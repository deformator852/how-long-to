import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// base: './' — относительные пути, чтобы сборка работала на GitHub Pages
// по адресу https://<user>.github.io/<repo>/ без хардкода имени репозитория.
export default defineConfig({
  base: './',
  // Самый большой чанк — MapLibre для 3D-вида (~1,1 МБ); он грузится лениво, только когда нужен.
  build: { chunkSizeWarningLimit: 1200 },
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Час підльоту',
        short_name: 'Підліт',
        description: 'Час польоту ракети або дрона між населеними пунктами України на максимальній швидкості',
        lang: 'uk',
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
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Шрифт иконок MDI запрашивается как ...woff2?v=7.4.47 — игнорируем ?v, иначе офлайн не найдёт его в кеше.
        ignoreURLParametersMatching: [/^v$/, /^utm_/],
        // Тайлы карты OSM: всегда из сети (сервер отдаёт no-cache), без сети — последние просмотренные.
        // Заранее ничего не скачиваем: массовая выгрузка тайлов запрещена правилами OSM.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'osm-tiles',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // 3D-вид: стиль, шрифты и векторные тайлы OpenFreeMap, рельеф AWS Terrain Tiles.
            urlPattern: /^https:\/\/(tiles\.openfreemap\.org|s3\.amazonaws\.com\/elevation-tiles-prod)\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'map3d-tiles',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 1500, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
})
