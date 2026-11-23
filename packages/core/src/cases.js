// Страница «Наскільки точний застосунок»: из реального эпизода (data/realCases.js) — хронология с реальным
// временем и расчёт приложения для тех же точек тем же кодом, что и основной расчёт.
import { REAL_CASES, SOURCES } from './data/realCases.js'
import { haversineKm } from './geo.js'
import { VEHICLES, flightMinutes, formatDuration } from './flight.js'
import { NUMBER_LOCALE, t } from './i18n.js'

export { REAL_CASES, SOURCES }

const TZ = 'Europe/Kyiv'
const timeFmt = new Intl.DateTimeFormat(NUMBER_LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dateFmt = new Intl.DateTimeFormat(NUMBER_LOCALE, { timeZone: TZ, day: 'numeric', month: 'long' })

/** «Герань-2 (Shahed-136)» → «Герань-2». */
export const vehicleShortTitle = (key) => t(`${key}.title`).replace(/\s*\(.*\)$/, '')

/** id всех пунктов, которые нужны примерам, — чтобы достать их из справочника. */
export const casePlaceIds = () => [...new Set(REAL_CASES.flatMap((c) => c.events.map((e) => e.point).filter(Boolean)))]

/**
 * Пример, готовый к показу.
 * @param {object} c запись из REAL_CASES
 * @param {Map<number, object> | null} placesById пункты из справочника (null — ещё не загружены: будет только хронология)
 */
export function buildCase(c, placesById) {
  // Точки маршрута — посты, где названо пройденное село; реальное время — от первой из них до последней.
  const route = c.events.filter((e) => e.point)
  const t0 = Date.parse(route[0].at)
  const realMin = (Date.parse(route.at(-1).at) - t0) / 60000

  const points = route.map((e) => placesById?.get(e.point))
  const ready = points.every(Boolean)
  let sum = 0
  const cumKm = ready ? points.map((p, i) => (sum += i ? haversineKm(points[i - 1], p) : 0)) : null // км от старта до точки
  const distanceKm = cumKm?.at(-1) ?? null
  const estimates = ready
    ? c.vehicles.map((key) => ({ key, speedKmh: VEHICLES[key].maxSpeedKmh, minutes: flightMinutes(distanceKm, VEHICLES[key].maxSpeedKmh) }))
    : []
  // Сравниваем с ближайшим по времени расчётом: тип реактивного БпЛА в постах не указывают.
  const closest = estimates.reduce((best, e) => (!best || Math.abs(e.minutes - realMin) < Math.abs(best.minutes - realMin) ? e : best), null)
  const appMin = estimates.length ? Math.min(...estimates.map((e) => e.minutes)) : null
  const appMax = estimates.length ? Math.max(...estimates.map((e) => e.minutes)) : null

  return {
    ...c,
    date: dateFmt.format(t0),
    realMin,
    points: ready ? points : null,
    distanceKm,
    estimates,
    closest,
    appRange: appMin == null ? '' : appMin === appMax ? formatDuration(appMin) : `${formatDuration(appMin)} – ${formatDuration(appMax)}`,
    events: c.events.map((e) => {
      const at = Date.parse(e.at)
      const i = route.indexOf(e)
      return {
        ...e,
        time: timeFmt.format(at),
        offset: at > t0 ? `+${formatDuration((at - t0) / 60000)}` : '',
        source: SOURCES[e.post.split('/')[0]],
        url: `https://t.me/${e.post}`,
        measured: i >= 0,
        // расчёт приложения до этой точки — для того же аппарата, что ближе всего по итоговому времени
        appAt: i > 0 && closest ? formatDuration(flightMinutes(cumKm[i], closest.speedKmh)) : '',
      }
    }),
  }
}

/** Вывод по примеру: насколько реальный полёт дольше или короче ближайшего расчёта. */
export function caseVerdict(built) {
  const diff = formatDuration(Math.abs(built.realMin - built.closest.minutes))
  const name = vehicleShortTitle(built.closest.key)
  return built.realMin >= built.closest.minutes ? t('casesLonger', { diff, name }) : t('casesShorter', { diff, name })
}
