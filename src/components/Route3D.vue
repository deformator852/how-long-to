<script setup>
// 3D-вид маршрута для режима «Список»: наклонённая карта с рельефом, над ней — лента полёта.
// MapLibre + векторные тайлы OpenFreeMap + рельеф AWS Terrain Tiles — всё без ключей.
// Высота ленты условная (сильно преувеличена), реальную высоту полёта приложение не знает.
import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
// Воркер MapLibre сам ищет себя рядом с бандлом — после сборки Vite его там нет, поэтому указываем явно.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTheme } from 'vuetify'
import { useFlightStore } from '../stores/flight'
import { placeName } from '../services/places'
import { haversineKm } from '../utils/geo'
import { t } from '../i18n'
import { legColorName, pinStyle } from '../utils/routeColors'

maplibregl.setWorkerUrl(workerUrl)

// side — карта в отдельной колонке слева на широком экране: во всю высоту окна, видна и до выбора маршрута,
// колесо мыши масштабирует карту (страница прокручивается в соседней колонке).
const props = defineProps({ side: { type: Boolean, default: false } })

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
const DEM = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 13,
  attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Mapzen Terrain</a>',
}
const PITCH = 60
const UKRAINE_BOUNDS = [[22.1, 44.3], [40.3, 52.4]]
const MAP_LOCALE = {
  'NavigationControl.ZoomIn': 'Наблизити',
  'NavigationControl.ZoomOut': 'Віддалити',
  'NavigationControl.ResetBearing': 'Повернути на північ',
  'FullscreenControl.Enter': 'На весь екран',
  'FullscreenControl.Exit': 'Вийти з повноекранного режиму',
  'AttributionControl.ToggleAttribution': 'Джерела даних',
  'CooperativeGesturesHandler.WindowsHelpText': 'Щоб змінити масштаб, прокручуйте з натиснутим Ctrl',
  'CooperativeGesturesHandler.MacHelpText': 'Щоб змінити масштаб, прокручуйте з натиснутим ⌘',
  'CooperativeGesturesHandler.MobileHelpText': 'Рухайте карту двома пальцями',
}

const { points } = storeToRefs(useFlightStore())
const theme = useTheme()
const el = ref(null)
const failed = ref(false)

let map = null
let markers = []
let styleReady = false

const M_PER_DEG_LAT = 110_540
const mPerDegLon = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180)

/** Начальный азимут от a к b, градусы по часовой от севера. */
function bearing(a, b) {
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

/**
 * Лента полёта — цепочка узких четырёхугольников, выдавленных (fill-extrusion) на условную высоту:
 * «ribbon» висит в воздухе, «curtain» — полупрозрачная стенка от земли до ленты.
 */
function routeData(pts) {
  const legColor = (leg) => theme.current.value.colors[legColorName(leg)] // у каждого отрезка свой цвет
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
      const color = legColor(b.leg)
      ribbon.push(polygon(ring, { base, top, color }))
      curtain.push(polygon(ring, { base: 0, top: base, color }))
    }
  }
  const track = pts.slice(1).map((b, i) => ({
    type: 'Feature',
    properties: { color: legColor(i) },
    geometry: { type: 'LineString', coordinates: [[pts[i].lon, pts[i].lat], [b.lon, b.lat]] },
  }))
  const fc = (features) => ({ type: 'FeatureCollection', features })
  return { ribbon: fc(ribbon), curtain: fc(curtain), track: fc(track) }
}

/** Подписи базовой карты — по-украински, где в OpenStreetMap есть name:uk. */
function localizeLabels() {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') continue
    const field = JSON.stringify(map.getLayoutProperty(layer.id, 'text-field') ?? '')
    if (field.includes('name')) map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:uk'], ['get', 'name']])
  }
}

/** Рельеф, отмывка и слои маршрута. Вызывается после каждой загрузки стиля (смена темы перезагружает стиль). */
function setupStyle() {
  localizeLabels()
  map.addSource('dem', DEM)
  map.addSource('dem-shade', DEM) // отдельный источник для отмывки — так советует MapLibre
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  map.addLayer({ id: 'hillshade', type: 'hillshade', source: 'dem-shade', paint: { 'hillshade-exaggeration': 0.3 } }, firstLabel)
  map.setTerrain({ source: 'dem', exaggeration: 1.5 })

  const data = routeData(points.value)
  for (const id of ['route-track', 'route-curtain', 'route-ribbon']) {
    map.addSource(id, { type: 'geojson', data: data[id.slice(6)] })
  }
  map.addLayer({
    id: 'route-track',
    type: 'line',
    source: 'route-track',
    paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [2, 2] },
  })
  map.addLayer({
    id: 'route-curtain',
    type: 'fill-extrusion',
    source: 'route-curtain',
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-base': ['get', 'base'],
      'fill-extrusion-height': ['get', 'top'],
      'fill-extrusion-opacity': 0.22,
    },
  })
  map.addLayer({
    id: 'route-ribbon',
    type: 'fill-extrusion',
    source: 'route-ribbon',
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-base': ['get', 'base'],
      'fill-extrusion-height': ['get', 'top'],
      'fill-extrusion-opacity': 0.95,
    },
  })
}

function updateRoute() {
  if (!styleReady) return // нарисуется в setupStyle
  const data = routeData(points.value)
  for (const id of ['route-track', 'route-curtain', 'route-ribbon']) map.getSource(id)?.setData(data[id.slice(6)])
}

function drawMarkers() {
  for (const m of markers) m.remove()
  markers = points.value.map((p, i) => {
    const pin = document.createElement('div')
    pin.className = 'route3d-pin'
    Object.assign(pin.style, pinStyle(i)) // цвет точки = цвет отрезка, который в неё ведёт
    pin.textContent = String(i + 1)
    const label = document.createElement('span')
    label.className = 'route3d-pin__label'
    label.textContent = placeName(p)
    pin.append(label)
    return new maplibregl.Marker({ element: pin }).setLngLat([p.lon, p.lat]).addTo(map)
  })
}

/**
 * Весь маршрут в кадре. Камера смотрит на маршрут сбоку и чуть вдоль: старт слева, цель справа и вдали —
 * так виден высотный профиль ленты (если смотреть точно вдоль маршрута, лента сливается в линию).
 */
function fit(duration = 0) {
  const pts = points.value
  if (pts.length === 1) {
    map.easeTo({ center: [pts[0].lon, pts[0].lat], zoom: 7, bearing: 0, pitch: PITCH, duration })
    return
  }
  if (!pts.length) {
    const cam = map.cameraForBounds(UKRAINE_BOUNDS, { padding: 20 })
    // при наклоне дальний край кадра уходит далеко за Украину — немного приближаем
    if (cam) map.easeTo({ ...cam, zoom: cam.zoom + 0.2, bearing: 0, pitch: PITCH, duration })
    return
  }
  const bounds = new maplibregl.LngLatBounds()
  for (const p of pts) bounds.extend([p.lon, p.lat])
  const camBearing = bearing(pts[0], pts.at(-1)) - 70
  const cam = map.cameraForBounds(bounds, { padding: 40, bearing: camBearing })
  if (!cam) return
  // cameraForBounds считает кадр без наклона; при наклоне и с лентой в воздухе нужен запас — отдаляем
  // (на узком экране меньше, иначе маршрут становится мелким).
  const zoomOut = map.getContainer().clientWidth < 500 ? 0.3 : 0.6
  map.easeTo({ ...cam, zoom: Math.min(cam.zoom, 11) - zoomOut, bearing: camBearing, pitch: PITCH, duration })
}

/** Кнопка под зумом: вернуть камеру ко всем точкам маршрута. */
class FitControl {
  onAdd() {
    this.box = document.createElement('div')
    this.box.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = btn.ariaLabel = t('route3dFit')
    btn.className = 'route3d-fit'
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3 3h6v2H5v4H3V3m12 0h6v6h-2V5h-4V3M3 15h2v4h4v2H3v-6m16 0h2v6h-6v-2h4v-4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>'
    btn.addEventListener('click', () => fit(800))
    this.box.append(btn)
    return this.box
  }

  onRemove() {
    this.box.remove()
  }
}

const styleUrl = () => (theme.current.value.dark ? STYLES.dark : STYLES.light)

onMounted(() => {
  try {
    map = new maplibregl.Map({
      container: el.value,
      style: styleUrl(),
      center: [31.2, 48.7],
      zoom: 5,
      pitch: PITCH,
      maxPitch: 80,
      cooperativeGestures: !props.side, // карта внутри прокручиваемой страницы — не перехватываем прокрутку
      locale: MAP_LOCALE,
    })
  } catch {
    failed.value = true // нет WebGL
    return
  }
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
  map.addControl(new FitControl(), 'top-right')
  map.addControl(new maplibregl.FullscreenControl(), 'top-right')
  // В тёмном стиле OpenFreeMap есть ссылки на иконки, которых нет в его спрайте, — подставляем пустые.
  map.setMissingStyleImageResolver((id) => map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) }))
  map.on('style.load', () => {
    styleReady = true
    failed.value = false
    setupStyle()
  })
  // Стиль не загрузился (нет сети) — показываем сообщение; ошибки отдельных тайлов не важны.
  map.on('error', () => {
    if (!styleReady) failed.value = true
  })
  drawMarkers()
  fit()
})

watch(
  () => points.value.map((p) => p.id).join('|'),
  () => {
    if (!map) return
    updateRoute()
    drawMarkers()
    fit(800)
  },
)

watch(
  () => theme.current.value.dark,
  () => {
    if (!map) return
    styleReady = false
    map.setStyle(styleUrl())
  },
)

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <v-card :class="{ 'route3d-card--side': side }">
    <v-card-item>
      <v-card-title class="text-title-medium">{{ t('route3d') }}</v-card-title>
      <v-card-subtitle class="route3d-hint">{{ t('route3dHint') }}</v-card-subtitle>
    </v-card-item>
    <div class="route3d-wrap">
      <div ref="el" class="route3d" />
      <div v-if="failed" class="route3d-error text-body-medium">{{ t('route3dFailed') }}</div>
    </div>
  </v-card>
</template>

<style>
/* Без scoped: маркеры создаются вручную, у них нет data-v-атрибутов. */
.route3d-hint {
  white-space: normal;
}

.route3d-wrap {
  position: relative;
}

.route3d-card--side {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.route3d-card--side .route3d-wrap {
  flex: 1;
  min-height: 0;
}

.route3d-card--side .route3d {
  height: 100%;
  min-height: 0;
}

.route3d {
  height: min(60vh, 460px);
  min-height: 300px;
}

.route3d-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  background: rgb(var(--v-theme-surface-light));
  color: rgb(var(--v-theme-on-surface));
}

.route3d-fit {
  display: flex !important;
  align-items: center;
  justify-content: center;
  color: #333;
}

.route3d-pin {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 26px;
  height: 26px;
  border: 2px solid rgb(var(--v-theme-surface));
  border-radius: 50%;
  font: 600 13px/1 system-ui, sans-serif;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
}

.route3d-pin__label {
  position: absolute;
  left: calc(100% + 4px);
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(var(--v-theme-surface), 0.9);
  color: rgb(var(--v-theme-on-surface));
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
}
</style>
