// Состояние калькулятора без привязки к UI: цепочка точек, выбранные аппараты, своя скорость, история.
// routeReducer — чистая функция (state, action) → state; deriveRoute считает производные (точки, км, время).
// React-обёртка — useFlight.js; сюда React не подключается, поэтому логику можно гонять в тестах под Node.
import { haversineKm } from './geo.js'
import { VEHICLES, flightMinutes } from './flight.js'

export const HISTORY_KEY = 'distance-count:history'
const HISTORY_LIMIT = 8

// Пункт маршрута: населённый пункт из справочника или точка с карты (custom: true).
const isPoint = (p) => Boolean(p && (p.custom || p.name) && Number.isFinite(p.lat) && Number.isFinite(p.lon))

/** Пункты, сохранённые двуязычной версией (nameUk/regionUk/nearUk), — к полям name/region/near. */
const migratePoint = (p) =>
  p && p.name === undefined && 'nameUk' in p ? { ...p, name: p.nameUk, region: p.regionUk ?? '', near: p.nearUk ?? '' } : p

export const routeKey = (points) => points.map((p) => p.id).join('-')

/** История из сохранённой строки JSON. Записи, которые не удалось разобрать, отбрасываем. */
export function parseHistory(json) {
  try {
    const h = JSON.parse(json) ?? []
    return h
      // Старый формат {from, to} → points.
      .map((e) => ({ ...e, points: (e.points ?? [e.from, e.to]).map(migratePoint) }))
      .filter((e) => e.points.length >= 2 && e.points.every(isPoint))
      .map((e) => ({
        key: routeKey(e.points),
        points: e.points,
        vehicles: (e.vehicles ?? [e.vehicle]).filter((v) => VEHICLES[v]),
      }))
      .filter((e) => e.vehicles.length)
  } catch {
    return []
  }
}

/**
 * `next` — правка маршрута `prev`, а не новый маршрут: в конец дописали точки, или набор
 * населённых пунктов из справочника тот же (точки на карте ставили, двигали, убирали, маршрут развернули).
 * Выбрали другой пункт или убрали пункт из справочника — это уже новая запись в истории.
 */
function isEditOf(prev, next) {
  if (prev.length < 2) return false
  const extended = next.length > prev.length && prev.every((p, i) => p.id === next[i].id)
  const placeIds = (points) => points.filter((p) => !p.custom).map((p) => p.id).sort().join()
  return extended || placeIds(prev) === placeIds(next)
}

/** История после смены маршрута prev → next: пока маршрут правят — обновляем его запись, а не плодим почти одинаковые. */
export function nextHistory(history, prev, next, vehicles) {
  if (next.length < 2) return history
  const key = routeKey(next)
  const replaceTop = history[0]?.key === routeKey(prev) && isEditOf(prev, next)
  return [
    { key, points: next, vehicles: [...vehicles] },
    ...history.slice(replaceTop ? 1 : 0).filter((h) => h.key !== key),
  ].slice(0, HISTORY_LIMIT)
}

/** Объединить историю, загруженную из хранилища, с уже набранной за это время (она новее). */
export function mergeHistory(current, loaded) {
  const keys = new Set(current.map((h) => h.key))
  return [...current, ...loaded.filter((h) => !keys.has(h.key))].slice(0, HISTORY_LIMIT)
}

let lastStopKey = 0
/** Слот цепочки. Пустой слот (place: null) — поле, которое ещё не заполнили. key — стабильный ключ для списков. */
export const newStop = (place = null) => ({ key: ++lastStopKey, place })

/** В цепочке всегда минимум два слота — «Откуда» и «Куда». */
export function padStops(list) {
  const out = [...list]
  while (out.length < 2) out.push(newStop())
  return out
}

/**
 * Начальное состояние. points/vehicles — начальный маршрут и аппараты;
 * trackHistory — вести «Нещодавні маршрути» (только у калькулятора главного экрана).
 */
export function initialRouteState({ points = [], vehicles = ['banderol'], trackHistory = false, history = [] } = {}) {
  return {
    stops: padStops(points.map((p) => newStop(p))),
    vehicles: [...vehicles],
    customSpeedKmh: VEHICLES.custom.maxSpeedKmh,
    trackHistory,
    history,
  }
}

const filled = (stops) => stops.filter((s) => s.place)
const pointsOf = (state) => filled(state.stops).map((s) => s.place)

/** Изменения цепочки без учёта истории. Новые слоты (stop/stops) создаёт вызывающий — редьюсер остаётся чистым. */
function applyAction(state, action) {
  switch (action.type) {
    case 'addStop':
      return { ...state, stops: [...state.stops, action.stop] }
    case 'removeStop':
      return { ...state, stops: padStops(state.stops.filter((s) => s.key !== action.key)) }
    case 'setPlace':
      return { ...state, stops: state.stops.map((s) => (s.key === action.key ? { ...s, place: action.place } : s)) }
    case 'addPoint': {
      // Точка с карты: в пустой слот после последней заполненной точки, иначе в конец цепочки.
      const i = state.stops.findLastIndex((s) => s.place) + 1
      if (state.stops[i]) return { ...state, stops: state.stops.map((s, j) => (j === i ? { ...s, place: action.place } : s)) }
      return { ...state, stops: [...state.stops, action.stop] }
    }
    case 'removeLastPoint': {
      const last = filled(state.stops).at(-1)
      return last ? applyAction(state, { type: 'removeStop', key: last.key }) : state
    }
    case 'reverse':
      return { ...state, stops: [...state.stops].reverse() }
    case 'clear':
      return { ...state, stops: action.stops }
    case 'restore':
      return { ...state, stops: action.stops, vehicles: [...action.vehicles] }
    case 'setVehicles':
      return action.vehicles.length ? { ...state, vehicles: [...action.vehicles] } : state // хотя бы один аппарат
    case 'setCustomSpeed':
      return { ...state, customSpeedKmh: action.value }
    case 'historyLoaded':
      return { ...state, history: mergeHistory(state.history, action.history), historyReady: true }
    default:
      return state
  }
}

export function routeReducer(state, action) {
  const next = applyAction(state, action)
  if (!next.trackHistory) return next
  const before = pointsOf(state)
  const after = pointsOf(next)
  if (routeKey(before) === routeKey(after)) return next
  // Восстановленный из истории маршрут — не правка текущего, его запись не затираем.
  const prev = action.type === 'restore' ? [] : before
  return { ...next, history: nextHistory(next.history, prev, after, next.vehicles) }
}

/** Действия для dispatch: новые слоты создаются здесь, а не в редьюсере. */
export const routeActions = {
  addStop: () => ({ type: 'addStop', stop: newStop() }),
  removeStop: (key) => ({ type: 'removeStop', key }),
  setPlace: (key, place) => ({ type: 'setPlace', key, place }),
  addPoint: (place) => ({ type: 'addPoint', place, stop: newStop(place) }),
  removeLastPoint: () => ({ type: 'removeLastPoint' }),
  reverse: () => ({ type: 'reverse' }),
  clear: () => ({ type: 'clear', stops: padStops([]) }),
  restore: (entry) => ({ type: 'restore', stops: padStops(entry.points.map((p) => newStop(p))), vehicles: entry.vehicles }),
  setVehicles: (vehicles) => ({ type: 'setVehicles', vehicles }),
  setCustomSpeed: (value) => ({ type: 'setCustomSpeed', value }),
  historyLoaded: (history) => ({ type: 'historyLoaded', history }),
}

/**
 * Производные значения: заполненные слоты, точки, длины отрезков, общее расстояние и результат
 * по каждому выбранному аппарату — от самого быстрого к самому медленному.
 */
export function deriveRoute({ stops, vehicles, customSpeedKmh }) {
  const filledStops = filled(stops)
  const points = filledStops.map((s) => s.place)
  /** legsKm[i] — от points[i] до points[i + 1], км. */
  const legsKm = points.slice(1).map((p, i) => haversineKm(points[i], p))
  const distanceKm = points.length >= 2 ? legsKm.reduce((sum, d) => sum + d, 0) : null
  const speedOf = (key) => (key === 'custom' ? Number(customSpeedKmh) || 0 : VEHICLES[key].maxSpeedKmh)
  const results =
    distanceKm == null
      ? []
      : vehicles
          .map((key) => {
            const speedKmh = speedOf(key)
            const range = VEHICLES[key].rangeKm
            return {
              key,
              ...VEHICLES[key],
              speedKmh,
              minutes: speedKmh > 0 ? flightMinutes(distanceKm, speedKmh) : null,
              outOfRange: range != null && distanceKm > range,
            }
          })
          .filter((r) => r.minutes != null)
          .sort((a, b) => a.minutes - b.minutes)
  return { filledStops, points, legsKm, distanceKm, results }
}
