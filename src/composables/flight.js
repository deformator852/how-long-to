// Состояние калькулятора: цепочка точек, выбранные аппараты, результат. Экземпляров может быть несколько
// (главная страница и примеры на странице точности) — каждый независим. FlightCalculator отдаёт свой
// экземпляр вниз через provide, компоненты внутри берут его через useFlight().
import { computed, inject, provide, reactive, ref, watch } from 'vue'
import { haversineKm } from '../utils/geo.js'
import { VEHICLES, flightMinutes } from '../utils/flight'

const HISTORY_KEY = 'distance-count:history'
const HISTORY_LIMIT = 8

// Пункт маршрута: населённый пункт из справочника или точка с карты (custom: true).
const isPoint = (p) => Boolean(p && (p.custom || p.name) && Number.isFinite(p.lat) && Number.isFinite(p.lon))

/** Пункты, сохранённые двуязычной версией (nameUk/regionUk/nearUk), — к полям name/region/near. */
const migratePoint = (p) =>
  p && p.name === undefined && 'nameUk' in p ? { ...p, name: p.nameUk, region: p.regionUk ?? '', near: p.nearUk ?? '' } : p
const routeKey = (points) => points.map((p) => p.id).join('-')

function loadHistory() {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? []
    return h
      // Старый формат {from, to} → points. Записи, которые не удалось разобрать, отбрасываем.
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

let lastStopKey = 0
const newStop = (place = null) => ({ key: ++lastStopKey, place })

/** В цепочке всегда минимум два слота — «Откуда» и «Куда». */
function pad(list) {
  while (list.length < 2) list.push(newStop())
  return list
}

/**
 * Новый калькулятор. points/vehicles — начальный маршрут и аппараты;
 * persistHistory — вести «Нещодавні маршрути» в localStorage (только у калькулятора главной страницы).
 */
export function createFlight({ points: initialPoints = [], vehicles: initialVehicles = ['banderol'], persistHistory = false } = {}) {
  // Слоты цепочки. Пустой слот (place: null) — поле, которое ещё не заполнили.
  const stops = ref(pad(initialPoints.map((p) => newStop(p))))
  const vehicles = ref([...initialVehicles])
  const customSpeedKmh = ref(VEHICLES.custom.maxSpeedKmh)
  const history = ref(persistHistory ? loadHistory() : [])

  const filledStops = computed(() => stops.value.filter((s) => s.place))
  const points = computed(() => filledStops.value.map((s) => s.place))
  /** Длина каждого отрезка цепочки, км: legsKm[i] — от points[i] до points[i + 1]. */
  const legsKm = computed(() => points.value.slice(1).map((p, i) => haversineKm(points.value[i], p)))
  const distanceKm = computed(() => (points.value.length >= 2 ? legsKm.value.reduce((sum, d) => sum + d, 0) : null))

  const speedOf = (key) => (key === 'custom' ? Number(customSpeedKmh.value) || 0 : VEHICLES[key].maxSpeedKmh)

  /** Результат по каждому выбранному аппарату, от самого быстрого к самому медленному. */
  const results = computed(() => {
    if (distanceKm.value == null) return []
    return vehicles.value
      .map((key) => {
        const speedKmh = speedOf(key)
        const range = VEHICLES[key].rangeKm
        return {
          key,
          ...VEHICLES[key],
          speedKmh,
          minutes: speedKmh > 0 ? flightMinutes(distanceKm.value, speedKmh) : null,
          outOfRange: range != null && distanceKm.value > range,
        }
      })
      .filter((r) => r.minutes != null)
      .sort((a, b) => a.minutes - b.minutes)
  })

  function addStop() {
    stops.value.push(newStop())
  }

  function removeStop(key) {
    stops.value = pad(stops.value.filter((s) => s.key !== key))
  }

  function setPlace(key, place) {
    const stop = stops.value.find((s) => s.key === key)
    if (stop) stop.place = place
  }

  /** Точка с карты: в пустой слот после последней заполненной точки, иначе в конец цепочки. */
  function addPoint(place) {
    const next = stops.value[stops.value.findLastIndex((s) => s.place) + 1]
    if (next) next.place = place
    else stops.value.push(newStop(place))
  }

  function removeLastPoint() {
    const last = filledStops.value.at(-1)
    if (last) removeStop(last.key)
  }

  function reverse() {
    stops.value = [...stops.value].reverse()
  }

  function clear() {
    stops.value = pad([])
  }

  // Маршрут до последнего изменения — чтобы отличить правку текущего маршрута от нового.
  let prevPoints = [...points.value]

  function restore(entry) {
    stops.value = pad(entry.points.map((p) => newStop(p)))
    vehicles.value = [...entry.vehicles]
    prevPoints = [] // восстановленный маршрут — не правка текущего, его запись не затираем
  }

  if (persistHistory) watch(() => routeKey(points.value), () => {
    const next = [...points.value]
    const prev = prevPoints
    prevPoints = next
    if (next.length < 2) return
    const key = routeKey(next)
    // Пока маршрут правят — обновляем его запись, а не плодим почти одинаковые.
    const replaceTop = history.value[0]?.key === routeKey(prev) && isEditOf(prev, next)
    history.value = [
      { key, points: next, vehicles: [...vehicles.value] },
      ...history.value.slice(replaceTop ? 1 : 0).filter((h) => h.key !== key),
    ].slice(0, HISTORY_LIMIT)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
    } catch {
      /* приватный режим — не сохраняем */
    }
  })

  // reactive — поля читаются без .value (flight.points), как у стора; для деструктуризации — toRefs(flight).
  return reactive({
    stops,
    vehicles,
    customSpeedKmh,
    history,
    filledStops,
    points,
    legsKm,
    distanceKm,
    results,
    addStop,
    removeStop,
    setPlace,
    addPoint,
    removeLastPoint,
    reverse,
    clear,
    restore,
  })
}

const FLIGHT = Symbol('flight')

/** Сделать калькулятор доступным компонентам внутри (EstimateResult, Route3D, RouteMap). */
export function provideFlight(flight) {
  provide(FLIGHT, flight)
}

/** Калькулятор ближайшего FlightCalculator выше по дереву. */
export function useFlight() {
  const flight = inject(FLIGHT, null)
  if (!flight) throw new Error('useFlight(): компонент должен быть внутри FlightCalculator')
  return flight
}
