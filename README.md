# Час підльоту

Строишь маршрут из любого числа точек — получаешь время полёта по прямым между ними при максимальной скорости (Бандероль, Герань-2, Герань-3, Герань-4, Герань-5 или своя скорость), общее и до каждой точки.

Веб-приложение — React 19 + [React Aria Components](https://react-spectrum.adobe.com/react-aria/) (компоненты без стилей) + обычный CSS. Вся логика вынесена в пакет `packages/core`, чтобы мобильное приложение на React Native подключало её, а не дублировало.

## Структура

```
src/                 веб-приложение: только интерфейс (React-компоненты, CSS, карты)
packages/core/       общая логика для веба и React Native — без DOM, fetch и localStorage
  src/               расчёт, справочник пунктов, состояние маршрута (useFlight), история, тексты, цвета, примеры
  data/places-ua.json  справочник населённых пунктов
  test/              тесты (node --test), идут под Node — заодно проверяют, что в пакете нет ничего из браузера
public/              иконки PWA
scripts/             сборка справочника и деплой
```

Корневой `package.json` — npm workspaces: веб подключает пакет как `@how-long-to/core`.

## Что где

- **Маршрут** — цепочка точек в двух режимах, маршрут у них общий:
  - «Список» — поля с поиском по населённым пунктам (`src/components/PlaceAutocomplete.jsx`, ComboBox из React Aria: без ввода — крупнейшие пункты, от двух букв — поиск, список подгружается при прокрутке); «Додати точку» дописывает точку в конец, крестик убирает. Рядом — 3D-вид маршрута (`src/components/Route3D.jsx`): на широком экране (от 1280 px) слева во всю высоту окна, на узком — под результатом: наклонённая карта с рельефом, над ней лента полёта со стенкой до земли; высота ленты условная, для наглядности. [MapLibre GL](https://maplibre.org) + векторные тайлы [OpenFreeMap](https://openfreemap.org) + рельеф [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), всё без ключей; MapLibre (~1,6 МБ с воркером) грузится отдельным чанком только для этого вида. Геометрия ленты — `routeGeometry` из core (GeoJSON, подойдёт и для MapLibre в React Native).
  - «Карта» — клик по карте ставит точку, отрезки рисуются стрелками с длиной в км; точки перетаскиваются, по клику на точку — название и «Прибрати». Точка с карты подписывается ближайшим пунктом (если он в пределах 15 км), иначе координатами. Карта — [Leaflet](https://leafletjs.com) + тайлы [OpenStreetMap](https://www.openstreetmap.org/copyright), грузится отдельным чанком только в этом режиме (`src/components/RouteMap.jsx`).
- **Калькулятор** — переиспользуемый компонент `src/components/FlightCalculator.jsx` (форма, результат, 2D- и 3D-карта). Состояние — хук `useFlight()` из core, экземпляр передают пропом `flight`. Экземпляров может быть сколько угодно, они независимы: на главной — один, с историей маршрутов в `localStorage`, на странице точности — свой у каждого примера.
- **Состояние маршрута** — `packages/core/src/route.js`: чистый редьюсер (`routeReducer`, `routeActions`) и расчёт производных (`deriveRoute`: точки, км, время по аппаратам); `useFlight.js` — React-обёртка над ними. История «Нещодавні маршрути» пишется в хранилище, которое передаёт приложение: `useFlight({ storage })`, где `storage` — что угодно с `getItem`/`setItem` (синхронными или асинхронными).
- **Время** — `packages/core/src/flight.js`: расстояние по дуге большого круга ÷ макс. скорость. Пресеты скоростей там же; цифры — открытые оценки ГУР/СМИ, источник указан в описании каждого аппарата (`packages/core/src/i18n.js`). Иконки аппаратов — имена [Material Design Icons](https://pictogrammers.com/library/mdi/): в вебе `@mdi/font`, в React Native — `MaterialCommunityIcons`.
- **Цвета** — у каждого отрезка маршрута свой цвет, точка красится цветом отрезка, который в неё ведёт (старт — оранжевый); одни и те же цвета в списке, таблице, на 2D- и 3D-карте. Палитры для светлой и тёмной темы — `packages/core/src/routeColors.js`; цвета интерфейса веба — CSS-переменные в `src/styles.css`, тема — по системной настройке.
- **Населённые пункты** — справочник `packages/core/data/places-ua.json` (~32 тыс. пунктов Украины), собран из [GeoNames](https://www.geonames.org) (CC BY 4.0); поиск — `packages/core/src/places.js`. Откуда брать сам файл, решает приложение: `configurePlaces({ load })` (веб скачивает его по URL при первом поиске, см. `src/main.jsx`). Показываются украинские названия; русские хранятся только как синонимы для поиска («Харьков» находит Харків). В подсказке — район и область: одноимённые сёла одной области различаются районом, а если совпадает и район, и расстояние до ближайшего города — ещё и направлением («4 км на південь від м. Вишневе»). При сборке убираются дубли GeoNames (одноимённые пункты одного района ближе 2 км) и правятся устаревшие названия районов (`DISTRICT_FIXES` в скрипте). `id` пункта — geonameid, он не меняется при пересборке.
  Пересобрать: скачать `UA.zip` и `alternatenames/UA.zip` с https://download.geonames.org/export/dump/, распаковать и запустить `python3 scripts/build_places.py <UA.txt> <alternatenames UA.txt> packages/core/data/places-ua.json`.
- **«Наскільки точний застосунок»** (`#accuracy`, `src/components/RealCases.jsx`) — реальные эпизоды атак: посты мониторингового канала «Кременчуцький Миколай» (@kremen_sv), где видно, какие сёла цель пролетала и когда, со ссылками на оригиналы и расчёт приложения для тех же точек (`buildCase` в `packages/core/src/cases.js`); «Перевірити самому» открывает в примере калькулятор с этим маршрутом. Данные примеров — `packages/core/src/data/realCases.js`: тексты постов дословно, время публикации в UTC, посты с `point` (id пункта из справочника) — точки маршрута. Берём только участки без разворотов; эпизоды, где скорость выходит больше, чем у любого БпЛА (канал переключился на другую цель), — нет.
- **Язык** — только украинский; тексты интерфейса — `packages/core/src/i18n.js` (общие для веба и мобильного).

## Мобильное приложение (React Native)

Логику не переписываем — подключаем `@how-long-to/core` (например, приложение Expo в `apps/mobile` и `"workspaces": ["packages/*", "apps/*"]` в корне):

```js
import AsyncStorage from '@react-native-async-storage/async-storage'
import { configurePlaces, useFlight, searchPlaces, placeName, t } from '@how-long-to/core'

configurePlaces({ load: async () => require('@how-long-to/core/data/places-ua.json') }) // справочник — из бандла

function Calculator() {
  const flight = useFlight({ storage: AsyncStorage }) // та же история «Нещодавні маршрути», только в AsyncStorage
  // flight.points, flight.results, flight.setPlace(key, place), flight.addStop(), flight.reverse()…
}
```

Своё у мобильного — только интерфейс: компоненты React Native вместо HTML/CSS, `useColorScheme` из `react-native` вместо медиазапроса, карты — `@maplibre/maplibre-react-native` (ленту даёт `routeGeometry`).

## Запуск

```sh
npm install
npm run dev     # веб-приложение
npm test        # тесты общей логики (packages/core)
```

## Деплой на GitHub Pages

```sh
npm run deploy
```

Собирает проект и публикует `dist/` в ветку `gh-pages` (скрипт `scripts/deploy.sh`; ветка каждый раз перезаписывается одним коммитом — в ней только сайт). Сайт: `https://<user>.github.io/<repo>/`, обновляется через 1–2 минуты после команды.
Один раз в настройках репозитория: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `gh-pages` / (root)**.
`base: './'` в `vite.config.js` — работает под любым именем репозитория.

## PWA

Приложение устанавливается на телефон/ПК («Установить» / «На экран Домой») и работает офлайн:
Service Worker (`vite-plugin-pwa`, режим `autoUpdate`) кеширует сборку и справочник пунктов.
Тайлы карт берутся из сети; без сети показываются последние просмотренные (кеши `osm-tiles` для 2D и `map3d-tiles` для 3D) — заранее ничего не скачивается.
Иконки — `public/pwa-*.png`, `maskable-512x512.png`, `apple-touch-icon.png` (из `public/favicon.svg`).
