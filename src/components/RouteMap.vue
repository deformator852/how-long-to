<script setup>
// Режим «Карта»: клик по карте добавляет точку в цепочку, отрезки рисуются стрелками.
// Leaflet управляет DOM сам, поэтому слои перерисовываются целиком при каждом изменении маршрута.
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useFlightStore } from '../stores/flight'
import { loadPlaces, mapPoint, placeName, placeSubtitle } from '../services/places'
import { haversineKm } from '../utils/geo'
import { NUMBER_LOCALE, t } from '../i18n'

const UKRAINE_BOUNDS = [[44.3, 22.1], [52.4, 40.3]]
const PIN_SIZE = 26 // px, диаметр кружка с номером точки (см. .route-pin)

const store = useFlightStore()
const { filledStops } = storeToRefs(store)
const el = ref(null)

let map = null
let legsLayer = null
let pinsLayer = null
let resizeObserver = null

const stopLatLngs = () => filledStops.value.map((s) => L.latLng(s.place.lat, s.place.lon))

/** Показать весь маршрут, а если точек нет — всю Украину. */
function fit() {
  const ll = stopLatLngs()
  if (ll.length) map.fitBounds(L.latLngBounds(ll), { padding: [40, 40], maxZoom: 10 })
  else map.fitBounds(UKRAINE_BOUNDS)
}

/**
 * Наконечник стрелки у точки назначения, повёрнутый по направлению отрезка.
 * Линия на карте — прямая в проекции Меркатора, поэтому угол на экране не зависит от масштаба.
 */
function arrowIcon(a, b) {
  const d = map.project(b, 0).subtract(map.project(a, 0))
  const deg = (Math.atan2(d.y, d.x) * 180) / Math.PI
  return L.divIcon({
    className: 'route-arrow',
    html: `<div style="transform: rotate(${deg}deg)"><svg width="16" height="14" viewBox="0 0 16 14"><path d="M0 0 16 7 0 14 4 7z"/></svg></div>`,
    iconSize: [0, 0],
  })
}

function drawLegs(ll) {
  legsLayer.clearLayers()
  for (let i = 1; i < ll.length; i++) {
    const [a, b] = [ll[i - 1], ll[i]]
    if (a.equals(b)) continue
    const km = Math.round(haversineKm({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng }))
    L.polyline([a, b], { className: 'route-leg-casing', interactive: false }).addTo(legsLayer)
    L.polyline([a, b], { className: 'route-leg', interactive: false })
      .bindTooltip(`${km.toLocaleString(NUMBER_LOCALE)} ${t('km')}`, {
        permanent: true,
        direction: 'center',
        className: 'route-leg-label',
      })
      .addTo(legsLayer)
    L.marker(b, { icon: arrowIcon(a, b), interactive: false, keyboard: false }).addTo(legsLayer)
  }
}

/** Попап точки: название, подпись и кнопка «Прибрать». Текст — через textContent, без HTML. */
function popupContent(stop) {
  const box = document.createElement('div')
  const title = document.createElement('div')
  title.className = 'route-popup__title'
  title.textContent = placeName(stop.place)
  const sub = document.createElement('div')
  sub.className = 'route-popup__sub'
  sub.textContent = placeSubtitle(stop.place)
  const remove = document.createElement('button')
  remove.type = 'button'
  remove.className = 'route-popup__remove'
  remove.textContent = t('removePoint')
  remove.addEventListener('click', () => {
    map.closePopup()
    store.removeStop(stop.key)
  })
  box.append(title, sub, remove)
  return box
}

function drawPins() {
  pinsLayer.clearLayers()
  filledStops.value.forEach((stop, i) => {
    const pin = L.marker([stop.place.lat, stop.place.lon], {
      icon: L.divIcon({
        className: i === 0 ? 'route-pin route-pin--start' : 'route-pin',
        html: String(i + 1),
        iconSize: [PIN_SIZE, PIN_SIZE],
        popupAnchor: [0, -PIN_SIZE / 2],
      }),
      title: placeName(stop.place),
      draggable: true,
      autoPan: true,
      riseOnHover: true,
    })
    // Попап заодно не даёт клику по точке уйти в карту и добавить новую точку поверх.
    pin.bindPopup(() => popupContent(stop))
    pin.on('drag', () => {
      const ll = stopLatLngs()
      ll[i] = pin.getLatLng()
      drawLegs(ll)
    })
    pin.on('dragend', async () => {
      const { lat, lng } = pin.getLatLng().wrap()
      store.setPlace(stop.key, await mapPoint(lat, lng))
    })
    pin.addTo(pinsLayer)
  })
}

function render() {
  if (!map) return
  drawPins()
  drawLegs(stopLatLngs())
}

onMounted(() => {
  loadPlaces().catch(() => {}) // заранее, чтобы первая точка сразу получила название
  map = L.map(el.value, { doubleClickZoom: false })
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    crossOrigin: true, // CORS-ответы service worker может кешировать для офлайна
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map)
  legsLayer = L.layerGroup().addTo(map)
  pinsLayer = L.layerGroup().addTo(map)

  // Клик, которым закрывают попап, точку не добавляет. preclick приходит раньше, чем попап закроется.
  let popupOpen = false
  let closingClick = false
  map.on('popupopen', () => (popupOpen = true))
  map.on('popupclose', () => (popupOpen = false))
  map.on('preclick', () => (closingClick = popupOpen))
  map.on('click', async (e) => {
    if (closingClick) return
    const { lat, lng } = e.latlng.wrap()
    store.addPoint(await mapPoint(lat, lng))
  })

  fit()
  render()
  resizeObserver = new ResizeObserver(() => map.invalidateSize())
  resizeObserver.observe(el.value)
})

watch(filledStops, render)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  map?.remove()
  map = null
})

defineExpose({ fit })
</script>

<template>
  <div ref="el" class="route-map" />
</template>

<style>
/* Без scoped: элементы внутри карты создаёт Leaflet, у них нет data-v-атрибутов. */
.route-map {
  height: min(65vh, 480px);
  min-height: 280px;
  border-radius: 8px;
  isolation: isolate; /* z-index панелей Leaflet не перекрывают меню и шапку приложения */
}

.route-map.leaflet-grab {
  cursor: crosshair;
}

.leaflet-dragging .route-map.leaflet-grab {
  cursor: grabbing;
}

.v-theme--dark .route-map .leaflet-tile-pane {
  filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9);
}

.v-theme--dark .route-map.leaflet-container {
  background: #262626;
}

.route-map .route-leg {
  stroke: rgb(var(--v-theme-primary));
  stroke-width: 3px;
  stroke-opacity: 1;
}

.route-map .route-leg-casing {
  stroke: rgb(var(--v-theme-surface));
  stroke-width: 7px;
  stroke-opacity: 0.85;
}

.route-map .route-arrow > div {
  position: absolute;
  transform-origin: 0 0;
}

/* Остриё — на краю кружка точки назначения: сдвиг на радиус кружка + длину наконечника. */
.route-map .route-arrow svg {
  position: absolute;
  left: -29px;
  top: -7px;
  fill: rgb(var(--v-theme-primary));
  stroke: rgb(var(--v-theme-surface));
  stroke-width: 1.5px;
  paint-order: stroke;
  overflow: visible;
}

.route-map .route-pin {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 2px solid rgb(var(--v-theme-surface));
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font: 600 13px/1 system-ui, sans-serif;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
  cursor: grab;
}

.route-map .route-pin--start {
  background: rgb(var(--v-theme-secondary));
  color: rgb(var(--v-theme-on-secondary));
}

.route-map .route-leg-label {
  padding: 1px 6px;
  border: none;
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
}

.route-map .route-leg-label::before {
  display: none;
}

.route-map .leaflet-popup-content-wrapper,
.route-map .leaflet-popup-tip {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
}

.route-map .leaflet-popup-content {
  margin: 12px 16px;
}

.route-popup__title {
  font-size: 15px;
  font-weight: 600;
}

.route-popup__sub {
  margin-top: 2px;
  opacity: 0.7;
}

.route-popup__remove {
  margin-top: 8px;
  padding: 4px 0;
  border: 0;
  background: none;
  color: rgb(var(--v-theme-error));
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
</style>
