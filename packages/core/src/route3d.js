// Геометрия 3D-ленты полёта для MapLibre (веб — maplibre-gl, мобильное — @maplibre/maplibre-react-native):
// цепочка узких четырёхугольников, выдавленных (fill-extrusion) на условную высоту. Высота сильно
// преувеличена — реальную высоту полёта приложение не знает.
import { haversineKm } from './geo.js'

const M_PER_DEG_LAT = 110_540
const mPerDegLon = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180)

/** Начальный азимут от a к b, градусы по часовой от севера. */
export function bearing(a, b) {
  const r = Math.PI / 180
  const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r)
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r)
  return (Math.atan2(y, x) / r + 360) % 360
}

/** Точки вдоль цепочки примерно через 1/200 её длины: { lon, lat, d, leg } (d — км от старта, leg — № отрезка). */
function samplePath(pts, totalKm) {
  const step = totalKm / 200
  const out = [{ lon: pts[0].lon, lat: pts[0].lat, d: 0, leg: 0 }]
  let start = 0
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]]
    const leg = haversineKm(a, b)
    const n = Math.max(1, Math.ceil(leg / step))
    for (let k = 1; k <= n; k++) {
      const f = k / n
      out.push({ lon: a.lon + (b.lon - a.lon) * f, lat: a.lat + (b.lat - a.lat) * f, d: start + leg * f, leg: i - 1 })
    }
    start += leg
  }
  return out
}

/** Условная высота, м: плавный набор после старта, «крейсер», плавное снижение к цели. */
function altitude(d, totalKm, cruiseM) {
  const ramp = Math.min(totalKm * 0.15, 80)
  const s = Math.min(1, Math.max(0, Math.min(d, totalKm - d) / ramp))
  return cruiseM * s * s * (3 - 2 * s)
}

const polygon = (ring, props) => ({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [ring] } })
const collection = (features) => ({ type: 'FeatureCollection', features })

/**
 * GeoJSON для трёх слоёв: ribbon — лента в воздухе, curtain — полупрозрачная стенка от земли до ленты,
 * track — пунктир по земле. У каждого объекта properties.color (цвет отрезка), у лент — base/top (м).
 * @param {{ lat: number, lon: number }[]} pts точки маршрута
 * @param {(leg: number) => string} colorOf цвет отрезка №leg
 */
export function routeGeometry(pts, colorOf) {
  let totalKm = 0
  for (let i = 1; i < pts.length; i++) totalKm += haversineKm(pts[i - 1], pts[i])
  const cruise = Math.max(8000, totalKm * 100) // м: заметно на экране при любом масштабе маршрута
  const thick = cruise * 0.08
  const halfWidth = Math.max(250, totalKm * 4) // м
  const ribbon = []
  const curtain = []
  if (totalKm > 0) {
    const path = samplePath(pts, totalKm)
    for (let i = 1; i < path.length; i++) {
      const [a, b] = [path[i - 1], path[i]]
      const kx = mPerDegLon((a.lat + b.lat) / 2)
      const dx = (b.lon - a.lon) * kx
      const dy = (b.lat - a.lat) * M_PER_DEG_LAT
      const len = Math.hypot(dx, dy)
      if (!len) continue
      const ox = ((-dy / len) * halfWidth) / kx
      const oy = ((dx / len) * halfWidth) / M_PER_DEG_LAT
      const ring = [[a.lon + ox, a.lat + oy], [b.lon + ox, b.lat + oy], [b.lon - ox, b.lat - oy], [a.lon - ox, a.lat - oy], [a.lon + ox, a.lat + oy]]
      const top = altitude((a.d + b.d) / 2, totalKm, cruise)
      const base = Math.max(0, top - thick)
      const color = colorOf(b.leg)
      ribbon.push(polygon(ring, { base, top, color }))
      curtain.push(polygon(ring, { base: 0, top: base, color }))
    }
  }
  const track = pts.slice(1).map((b, i) => ({
    type: 'Feature',
    properties: { color: colorOf(i) },
    geometry: { type: 'LineString', coordinates: [[pts[i].lon, pts[i].lat], [b.lon, b.lat]] },
  }))
  return { ribbon: collection(ribbon), curtain: collection(curtain), track: collection(track) }
}
