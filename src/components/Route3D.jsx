// 3D-вид маршрута для режима «Список»: наклонённая карта с рельефом, над ней — лента полёта.
// MapLibre + векторные тайлы OpenFreeMap + рельеф AWS Terrain Tiles — всё без ключей.
// Геометрия ленты — routeGeometry из core (её же сможет рисовать мобильное приложение).
import 'maplibre-gl/dist/maplibre-gl.css'
import './Route3D.css'
import * as maplibregl from 'maplibre-gl'
// Воркер MapLibre сам ищет себя рядом с бандлом — после сборки Vite его там нет, поэтому указываем явно.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { bearing, legColor, pinColors, placeName, routeGeometry, t } from '@how-long-to/core'
import { useColorScheme } from '../useMediaQuery'

maplibregl.setWorkerUrl(workerUrl)

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
const ROUTE_LAYERS = ['route-track', 'route-curtain', 'route-ribbon']
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

/** Подписи базовой карты — по-украински, где в OpenStreetMap есть name:uk. */
function localizeLabels(map) {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') continue
    const field = JSON.stringify(map.getLayoutProperty(layer.id, 'text-field') ?? '')
    if (field.includes('name')) map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:uk'], ['get', 'name']])
  }
}

/** Кнопка под зумом: вернуть камеру ко всем точкам маршрута. */
class FitControl {
  constructor(onFit) {
    this.onFit = onFit
  }

  onAdd() {
    this.box = document.createElement('div')
    this.box.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = btn.ariaLabel = t('route3dFit')
    btn.className = 'route3d-fit'
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3 3h6v2H5v4H3V3m12 0h6v6h-2V5h-4V3M3 15h2v4h4v2H3v-6m16 0h2v6h-6v-2h4v-4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>'
    btn.addEventListener('click', () => this.onFit())
    this.box.append(btn)
    return this.box
  }

  onRemove() {
    this.box.remove()
  }
}

/**
 * side — карта в отдельной колонке слева на широком экране: во всю высоту окна, видна и до выбора маршрута,
 * колесо мыши масштабирует карту (страница прокручивается в соседней колонке).
 */
export default function Route3D({ points, side = false, className = '' }) {
  const el = useRef(null)
  const map = useRef(null)
  const markers = useRef([])
  const styleReady = useRef(false)
  const [failed, setFailed] = useState(false)
  const scheme = useColorScheme()
  // Обработчики MapLibre создаются один раз — берут актуальные точки и тему отсюда.
  const latest = useRef({ points, scheme })
  latest.current = { points, scheme }

  const geometry = () => routeGeometry(latest.current.points, (leg) => legColor(leg, latest.current.scheme))

  /** Рельеф, отмывка и слои маршрута. Вызывается после каждой загрузки стиля (смена темы перезагружает стиль). */
  function setupStyle() {
    const m = map.current
    localizeLabels(m)
    m.addSource('dem', DEM)
    m.addSource('dem-shade', DEM) // отдельный источник для отмывки — так советует MapLibre
    const firstLabel = m.getStyle().layers.find((l) => l.type === 'symbol')?.id
    m.addLayer({ id: 'hillshade', type: 'hillshade', source: 'dem-shade', paint: { 'hillshade-exaggeration': 0.3 } }, firstLabel)
    m.setTerrain({ source: 'dem', exaggeration: 1.5 })

    const data = geometry()
    for (const id of ROUTE_LAYERS) m.addSource(id, { type: 'geojson', data: data[id.slice(6)] })
    m.addLayer({
      id: 'route-track',
      type: 'line',
      source: 'route-track',
      paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [2, 2] },
    })
    for (const [id, opacity] of [['route-curtain', 0.22], ['route-ribbon', 0.95]]) {
      m.addLayer({
        id,
        type: 'fill-extrusion',
        source: id,
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-base': ['get', 'base'],
          'fill-extrusion-height': ['get', 'top'],
          'fill-extrusion-opacity': opacity,
        },
      })
    }
  }

  function updateRoute() {
    if (!styleReady.current) return // нарисуется в setupStyle
    const data = geometry()
    for (const id of ROUTE_LAYERS) map.current.getSource(id)?.setData(data[id.slice(6)])
  }

  function drawMarkers() {
    for (const m of markers.current) m.remove()
    markers.current = latest.current.points.map((p, i) => {
      const pin = document.createElement('div')
      pin.className = 'route3d-pin'
      Object.assign(pin.style, pinColors(i, latest.current.scheme)) // цвет точки = цвет отрезка, который в неё ведёт
      pin.textContent = String(i + 1)
      const label = document.createElement('span')
      label.className = 'route3d-pin__label'
      label.textContent = placeName(p)
      pin.append(label)
      return new maplibregl.Marker({ element: pin }).setLngLat([p.lon, p.lat]).addTo(map.current)
    })
  }

  /**
   * Весь маршрут в кадре. Камера смотрит на маршрут сбоку и чуть вдоль: старт слева, цель справа и вдали —
   * так виден высотный профиль ленты (если смотреть точно вдоль маршрута, лента сливается в линию).
   */
  function fit(duration = 0) {
    const m = map.current
    if (!m) return
    const pts = latest.current.points
    if (pts.length === 1) {
      m.easeTo({ center: [pts[0].lon, pts[0].lat], zoom: 7, bearing: 0, pitch: PITCH, duration })
      return
    }
    if (!pts.length) {
      const cam = m.cameraForBounds(UKRAINE_BOUNDS, { padding: 20 })
      // при наклоне дальний край кадра уходит далеко за Украину — немного приближаем
      if (cam) m.easeTo({ ...cam, zoom: cam.zoom + 0.2, bearing: 0, pitch: PITCH, duration })
      return
    }
    const bounds = new maplibregl.LngLatBounds()
    for (const p of pts) bounds.extend([p.lon, p.lat])
    const camBearing = bearing(pts[0], pts.at(-1)) - 70
    const cam = m.cameraForBounds(bounds, { padding: 40, bearing: camBearing })
    if (!cam) return
    // cameraForBounds считает кадр без наклона; при наклоне и с лентой в воздухе нужен запас — отдаляем
    // (на узком экране меньше, иначе маршрут становится мелким).
    const zoomOut = m.getContainer().clientWidth < 500 ? 0.3 : 0.6
    m.easeTo({ ...cam, zoom: Math.min(cam.zoom, 11) - zoomOut, bearing: camBearing, pitch: PITCH, duration })
  }

  useEffect(() => {
    let m
    try {
      m = new maplibregl.Map({
        container: el.current,
        style: STYLES[latest.current.scheme],
        center: [31.2, 48.7],
        zoom: 5,
        pitch: PITCH,
        maxPitch: 80,
        cooperativeGestures: !side, // карта внутри прокручиваемой страницы — не перехватываем прокрутку
        locale: MAP_LOCALE,
      })
    } catch {
      setFailed(true) // нет WebGL
      return
    }
    map.current = m
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    m.addControl(new FitControl(() => fit(800)), 'top-right')
    m.addControl(new maplibregl.FullscreenControl(), 'top-right')
    // В тёмном стиле OpenFreeMap есть ссылки на иконки, которых нет в его спрайте, — подставляем пустые.
    m.setMissingStyleImageResolver((id) => m.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) }))
    m.on('style.load', () => {
      styleReady.current = true
      setFailed(false)
      setupStyle()
    })
    // Стиль не загрузился (нет сети) — показываем сообщение; ошибки отдельных тайлов не важны.
    m.on('error', () => {
      if (!styleReady.current) setFailed(true)
    })
    drawMarkers()
    fit()
    return () => {
      m.remove()
      map.current = null
      styleReady.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- карта создаётся один раз

  // Маршрут поменялся — перерисовать ленту и точки, плавно показать весь маршрут.
  const routeKey = points.map((p) => p.id).join('|')
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (!map.current) return
    updateRoute()
    drawMarkers()
    fit(800)
  }, [routeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Тема поменялась — другой стиль карты (setupStyle сработает на style.load) и цвета точек.
  const firstScheme = useRef(scheme)
  useEffect(() => {
    if (!map.current || firstScheme.current === scheme) return
    firstScheme.current = scheme
    styleReady.current = false
    map.current.setStyle(STYLES[scheme])
    drawMarkers()
  }, [scheme]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className={`card ${side ? 'route3d-card--side' : ''} ${className}`}>
      <div className="card__header">
        <h2 className="card__title text-title-medium">{t('route3d')}</h2>
        <p className="card__subtitle route3d-hint">{t('route3dHint')}</p>
      </div>
      <div className="route3d-wrap">
        <div ref={el} className="route3d" />
        {failed && <div className="route3d-error text-body-medium">{t('route3dFailed')}</div>}
      </div>
    </section>
  )
}
