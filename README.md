# Время подлёта

Фронтовое приложение (Vue 3 + Vuetify 4 + Pinia): выбираешь откуда и куда — получаешь время полёта по прямой при максимальной скорости (Бандероль, Герань-2, Герань-3, Герань-5 или своя скорость).

- **Населённые пункты** — локальный справочник `public/places-ua.json` (~32 тыс. пунктов Украины с русскими названиями), собран из [GeoNames](https://www.geonames.org) (CC BY 4.0). Пересобрать: скачать `UA.zip` и `alternatenames/UA.zip` с https://download.geonames.org/export/dump/, распаковать и запустить `python3 scripts/build_places.py <UA.txt> <alternatenames UA.txt> public/places-ua.json`.
- **Время** — `src/utils/flight.js`: расстояние по дуге большого круга ÷ макс. скорость. Пресеты скоростей там же.

## Запуск

```sh
npm install
npm run dev
```

## Деплой на GitHub Pages

Workflow `.github/workflows/deploy.yml` собирает и выкладывает `dist` при пуше в `main`.
В настройках репозитория: **Settings → Pages → Source: GitHub Actions**.
`base: './'` в `vite.config.js` — работает под любым именем репозитория.

## PWA

Приложение устанавливается на телефон/ПК («Установить» / «На экран Домой») и работает офлайн:
Service Worker (`vite-plugin-pwa`, режим `autoUpdate`) кеширует сборку и справочник пунктов.
Иконки — `public/pwa-*.png`, `maskable-512x512.png`, `apple-touch-icon.png` (из `public/favicon.svg`).
