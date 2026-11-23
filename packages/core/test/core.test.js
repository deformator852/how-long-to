// Тесты общей логики. Запускаются под Node (без DOM) — заодно проверяют, что пакет не тянет ничего из браузера.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  REAL_CASES,
  buildCase,
  casePlaceIds,
  configurePlaces,
  deriveRoute,
  formatDuration,
  haversineKm,
  initialRouteState,
  loadPlaces,
  mapPoint,
  parseHistory,
  pinColors,
  routeActions,
  routeReducer,
  searchPlaces,
  topPlaces,
} from '../src/index.js'

configurePlaces({ load: async () => JSON.parse(readFileSync(new URL('../data/places-ua.json', import.meta.url), 'utf8')) })

const place = async (name) => (await searchPlaces(name)).find((p) => p.name === name)

test('расстояние и время', () => {
  const km = haversineKm({ lat: 50.4547, lon: 30.5238 }, { lat: 49.9808, lon: 36.2527 })
  assert.ok(km > 405 && km < 415, `Київ–Харків: ${km}`)
  assert.equal(formatDuration(83.4), '1 год 23 хв')
  assert.equal(formatDuration(40 / 370 * 60), '6 хв 29 с')
  assert.equal(formatDuration(0.5), '30 с')
})

test('поиск пунктов: по-украински, по-русски, крупнейшие', async () => {
  assert.equal((await searchPlaces('Харків'))[0].name, 'Харків')
  assert.ok((await searchPlaces('Харьков')).some((p) => p.name === 'Харків'))
  assert.equal((await topPlaces(1))[0].name, 'Київ')
  assert.deepEqual(await searchPlaces('х'), []) // меньше двух букв не ищем
})

test('точка с карты подписывается ближайшим пунктом', async () => {
  const p = await mapPoint(49.836, 36.687) // окраина Чугуєва
  assert.equal(p.custom, true)
  assert.equal(p.name, 'Чугуїв')
})

test('маршрут: точки, расстояние, результат от быстрого к медленному', async () => {
  const [kyiv, kharkiv] = [await place('Київ'), await place('Харків')]
  let s = initialRouteState({ vehicles: ['geran2', 'banderol'] })
  s = routeReducer(s, routeActions.addPoint(kyiv))
  s = routeReducer(s, routeActions.addPoint(kharkiv))
  const r = deriveRoute(s)
  assert.equal(r.points.length, 2)
  assert.equal(Math.round(r.distanceKm), 411)
  assert.deepEqual(r.results.map((x) => x.key), ['banderol', 'geran2'])
  assert.equal(formatDuration(r.results[0].minutes), '37 хв 56 с')

  s = routeReducer(s, routeActions.reverse())
  assert.equal(deriveRoute(s).points[0].name, 'Харків')
  s = routeReducer(s, routeActions.setVehicles([]))
  assert.equal(s.vehicles.length, 2, 'хотя бы один аппарат остаётся выбранным')
})

test('история: правка маршрута обновляет запись, новый маршрут — новая запись', async () => {
  const [kyiv, kharkiv, poltava, odesa] = await Promise.all(['Київ', 'Харків', 'Полтава', 'Одеса'].map(place))
  let s = initialRouteState({ trackHistory: true })
  for (const p of [kyiv, kharkiv]) s = routeReducer(s, routeActions.addPoint(p))
  assert.equal(s.history.length, 1)
  s = routeReducer(s, routeActions.addPoint(poltava)) // дописали точку — это правка
  assert.equal(s.history.length, 1)
  assert.equal(s.history[0].points.length, 3)
  const first = s.stops[0].key
  s = routeReducer(s, routeActions.setPlace(first, odesa)) // другой пункт — новый маршрут
  assert.equal(s.history.length, 2)
  s = routeReducer(s, routeActions.restore(s.history[1])) // восстановили старый — он наверху, без дублей
  assert.equal(s.history.length, 2)
  assert.equal(s.history[0].points[0].name, 'Київ')
  assert.deepEqual(parseHistory(JSON.stringify(s.history)).map((h) => h.key), s.history.map((h) => h.key))
  assert.deepEqual(parseHistory('не json'), [])
})

test('калькулятор без истории её не ведёт', async () => {
  let s = initialRouteState()
  for (const p of await Promise.all(['Київ', 'Харків'].map(place))) s = routeReducer(s, routeActions.addPoint(p))
  assert.deepEqual(s.history, [])
})

test('примеры точности: те же цифры, что на странице', async () => {
  const list = await loadPlaces()
  const ids = new Set(casePlaceIds())
  const byId = new Map(list.filter((p) => ids.has(p.id)).map((p) => [p.id, p]))
  const c = buildCase(REAL_CASES[0], byId)
  assert.equal(formatDuration(c.realMin), '11 хв 15 с')
  assert.equal(c.closest.key, 'geran3')
  assert.deepEqual(c.events.map((e) => e.appAt), ['', '5 хв 52 с', '9 хв 26 с', '11 хв 13 с'])
  assert.equal(c.events[0].time, '21:06:20')
  assert.equal(buildCase(REAL_CASES[0], null).points, null) // справочник не загружен — только хронология
})

test('цвета точек: контрастный текст, как выбирал Vuetify', () => {
  assert.deepEqual(pinColors(1, 'light'), { background: '#1f5fbf', color: '#ffffff' })
  assert.equal(pinColors(1, 'dark').color, '#ffffff') // как у Vuetify: белый, пока он читается
  assert.equal(pinColors(0, 'dark').color, '#000000') // светло-оранжевый старт — чёрный
})
