// Режим «Карта»: клик по карте добавляет точку в цепочку, отрезки рисуются стрелками.
// Leaflet управляет DOM сам, поэтому слои перерисовываются целиком при каждом изменении маршрута.
import 'leaflet/dist/leaflet.css'
import './RouteMap.css'
import L from 'leaflet'
import { useEffect, useImperativeHandle, useRef } from 'react'
import { NUMBER_LOCALE, haversineKm, legColor, loadPlaces, mapPoint, pinColors, placeName, placeSubtitle, t } from '@how-long-to/core'
import { useColorScheme } from '../useMediaQuery'

const UKRAINE_BOUNDS = [[44.3, 22.1], [52.4, 40.3]]
const PIN_SIZE = 26 // px, диаметр кружка с номером точки (см. .route-pin)

/**
 * Наконечник стрелки у точки назначения, повёрнутый по направлению отрезка.
 * Линия на карте — прямая в проекции Меркатора, поэтому угол на экране не зависит от масштаба.
 */
function arrowIcon(map, a, b, color) {
  const d = map.project(b, 0).subtract(map.project(a, 0))
  const deg = (Math.atan2(d.y, d.x) * 180) / Math.PI
  return L.divIcon({
    className: 'route-arrow',
    html: `<div style="transform: rotate(${deg}deg)"><svg width="16" height="14" viewBox="0 0 16 14" style="fill: ${color}"><path d="M0 0 16 7 0 14 4 7z"/></svg></div>`,
    iconSize: [0, 0],
  })
}

/** ref → { fit() }: показать весь маршрут, а если точек нет — всю Украину. */
export default function RouteMap({ flight, ref }) {
  const el = useRef(null)
  const map = useRef(null)
  const layers = useRef(null)
  const scheme = useColorScheme()
  // Обработчики Leaflet создаются один раз — берут актуальные маршрут и тему отсюда.
  const latest = useRef({ flight, scheme })
  latest.current = { flight, scheme }

  const stopLatLngs = () => latest.current.flight.filledStops.map((s) => L.latLng(s.place.lat, s.place.lon))

  function fit() {
    if (!map.current) return
    const ll = stopLatLngs()
    if (ll.length) map.current.fitBounds(L.latLngBounds(ll), { padding: [40, 40], maxZoom: 10 })
    else map.current.fitBounds(UKRAINE_BOUNDS)
  }

  useImperativeHandle(ref, () => ({ fit }), [])

  function drawLegs(ll) {
    const { legs } = layers.current
    legs.clearLayers()
    for (let i = 1; i < ll.length; i++) {
      const [a, b] = [ll[i - 1], ll[i]]
      if (a.equals(b)) continue
      const km = Math.round(haversineKm({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng }))
      const color = legColor(i - 1, latest.current.scheme) // у каждого отрезка свой цвет
      L.polyline([a, b], { className: 'route-leg-casing', interactive: false }).addTo(legs)
      L.polyline([a, b], { className: 'route-leg', color, interactive: false })
        .bindTooltip(`${km.toLocaleString(NUMBER_LOCALE)} ${t('km')}`, {
          permanent: true,
          direction: 'center',
          className: 'route-leg-label',
        })
        .addTo(legs)
      L.marker(b, { icon: arrowIcon(map.current, a, b, color), interactive: false, keyboard: false }).addTo(legs)
    }
  }

  /** Попап точки: название, подпись и кнопка «Прибрати». Текст — через textContent, без HTML. */
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
      map.current.closePopup()
      latest.current.flight.removeStop(stop.key)
    })
    box.append(title, sub, remove)
    return box
  }

  function drawPins() {
    const { pins } = layers.current
    pins.clearLayers()
    latest.current.flight.filledStops.forEach((stop, i) => {
      const pin = L.marker([stop.place.lat, stop.place.lon], {
        icon: L.divIcon({
          className: 'route-pin',
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
        latest.current.flight.setPlace(stop.key, await mapPoint(lat, lng))
      })
      pin.addTo(pins)
      Object.assign(pin.getElement().style, pinColors(i, latest.current.scheme)) // цвет точки = цвет отрезка, который в неё ведёт
    })
  }

  function render() {
    if (!map.current) return
    drawPins()
    drawLegs(stopLatLngs())
  }

  useEffect(() => {
    loadPlaces().catch(() => {}) // заранее, чтобы первая точка сразу получила название
    const m = L.map(el.current, { doubleClickZoom: false })
    map.current = m
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true, // CORS-ответы service worker может кешировать для офлайна
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(m)
    layers.current = { legs: L.layerGroup().addTo(m), pins: L.layerGroup().addTo(m) }

    // Клик, которым закрывают попап, точку не добавляет. preclick приходит раньше, чем попап закроется.
    let popupOpen = false
    let closingClick = false
    m.on('popupopen', () => (popupOpen = true))
    m.on('popupclose', () => (popupOpen = false))
    m.on('preclick', () => (closingClick = popupOpen))
    m.on('click', async (e) => {
      if (closingClick) return
      const { lat, lng } = e.latlng.wrap()
      latest.current.flight.addPoint(await mapPoint(lat, lng))
    })

    fit()
    render()
    const resizeObserver = new ResizeObserver(() => m.invalidateSize())
    resizeObserver.observe(el.current)
    return () => {
      resizeObserver.disconnect()
      m.remove()
      map.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- карта создаётся один раз

  // Маршрут или тема поменялись — перерисовать (цвета линий зависят от темы).
  useEffect(render, [flight.filledStops, scheme]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="route-map" />
}
