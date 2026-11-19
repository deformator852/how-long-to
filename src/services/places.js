// Поиск населённых пунктов Украины по локальному справочнику public/places-ua.json
// (собирается скриптом scripts/build_places.py из GeoNames, CC BY 4.0).
// Показываются украинские названия; искать можно и по-украински, и по-русски.
import { NUMBER_LOCALE, t } from '../i18n'
import { haversineKm } from '../utils/geo'

// Дальше этого точку с карты не называем по ближайшему пункту (море, территория РФ) — только координаты.
const NEAR_LIMIT_KM = 15

const DIRECTIONS = [
  'на північ', 'на північний схід', 'на схід', 'на південний схід',
  'на південь', 'на південний захід', 'на захід', 'на північний захід',
]

let indexPromise = null

const normalize = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[’'ʼ`]/g, '')

/** Направление от `from` к `to` по сторонам света: «на північний захід». */
function direction(from, to) {
  const dx = (to.lon - from.lon) * Math.cos((from.lat * Math.PI) / 180)
  const dy = to.lat - from.lat
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI // 0° — север, 90° — восток
  return DIRECTIONS[Math.round((deg + 360) / 45) % 8]
}

/** Загружает справочник один раз; повторные вызовы получают тот же промис. */
export function loadPlaces() {
  indexPromise ??= fetch(`${import.meta.env.BASE_URL}places-ua.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`places-ua.json: HTTP ${res.status}`)
      return res.json()
    })
    .then(({ regions, districts, places }) => {
      const list = places.map(([id, name, ru, region, district, lat, lon, population, nearIdx, nearKm]) => ({
        id,
        name,
        region: regions[region] ?? '',
        district: districts[district] ?? '',
        lat,
        lon,
        population,
        nearIdx,
        nearKm,
        keys: [normalize(name), ...(ru ? [normalize(ru)] : [])],
      }))
      for (const p of list) p.near = p.nearIdx >= 0 ? list[p.nearIdx].name : ''

      // Одноимённые пункты одного района на одном расстоянии от одного города различаем направлением.
      const sameHint = new Map()
      for (const p of list) {
        if (!p.near) continue
        const key = [p.name, p.region, p.district, p.nearIdx, p.nearKm].join('|')
        sameHint.set(key, [...(sameHint.get(key) ?? []), p])
      }
      for (const group of sameHint.values()) {
        if (group.length > 1) for (const p of group) p.nearDir = direction(list[p.nearIdx], p)
      }
      return list
    })
    .catch((e) => {
      indexPromise = null // дать шанс повторить загрузку
      throw e
    })
  return indexPromise
}

/**
 * Ранжирование: точное совпадение → начало названия → начало слова внутри названия.
 * Внутри группы — по убыванию населения (справочник уже так отсортирован).
 */
export async function searchPlaces(query, limit = 10) {
  const q = normalize(query.trim())
  if (q.length < 2) return []
  const list = await loadPlaces()
  const buckets = [[], [], []]
  for (const p of list) {
    let rank = 3
    for (const k of p.keys) {
      if (k === q) rank = 0
      else if (k.startsWith(q)) rank = Math.min(rank, 1)
      else if (rank > 2 && (k.includes(` ${q}`) || k.includes(`-${q}`))) rank = 2
    }
    if (rank < 3 && buckets[rank].length < limit) buckets[rank].push(p)
  }
  return buckets.flat().slice(0, limit)
}

/** Ближайший населённый пункт справочника (для подписи точек, поставленных на карте). */
export async function nearestPlace(lat, lon) {
  const list = await loadPlaces()
  const kx = Math.cos((lat * Math.PI) / 180) // поправка на сужение градуса долготы
  let best = null
  let bestD = Infinity
  for (const p of list) {
    const d = ((p.lon - lon) * kx) ** 2 + (p.lat - lat) ** 2
    if (d < bestD) [best, bestD] = [p, d]
  }
  return best
}

/** Точка маршрута, поставленная на карте. Подписывается ближайшим пунктом, если он рядом. */
export async function mapPoint(lat, lon) {
  lat = Number(lat.toFixed(5))
  lon = Number(lon.toFixed(5))
  let near = null
  try {
    near = await nearestPlace(lat, lon)
  } catch {
    /* справочник не загрузился — останутся координаты */
  }
  const nearKm = near ? haversineKm({ lat, lon }, near) : Infinity
  const named = nearKm <= NEAR_LIMIT_KM
  return {
    id: `pt${lat},${lon}`,
    custom: true,
    lat,
    lon,
    name: named ? near.name : '',
    region: named ? near.region : '',
    district: named ? near.district : '',
    nearKm: named ? Math.round(nearKm) : null,
  }
}

const coords = (p) => `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}`

/** Название пункта; точка с карты — «≈ Чугуїв» или координаты, если пунктов рядом нет. */
export function placeName(p) {
  if (!p) return ''
  if (p.custom) return p.name ? `≈ ${p.name}` : coords(p)
  return p.name
}

/** Подпись под названием: «Чугуївський р-н, Харківська обл. · 13 км від м. Харків». */
export function placeSubtitle(p) {
  const where = [p.district, p.region].filter(Boolean).join(', ')
  let hint = ''
  if (p.custom) {
    if (p.name && p.nearKm > 0) hint = t('kmFromPlace', { km: p.nearKm, name: p.name })
  } else if (p.near && p.nearKm > 0) {
    hint = p.nearDir
      ? t('kmFromDir', { km: p.nearKm, dir: p.nearDir, city: p.near })
      : t('kmFrom', { km: p.nearKm, city: p.near })
  } else if (p.population >= 10000) {
    hint = t('residents', { n: p.population.toLocaleString(NUMBER_LOCALE) })
  }
  return [where, hint, p.custom ? coords(p) : ''].filter(Boolean).join(' · ')
}
