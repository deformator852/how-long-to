// Поиск населённых пунктов Украины по локальному справочнику public/places-ua.json
// (собирается скриптом scripts/build_places.py из GeoNames, CC BY 4.0).
// Названия на русском; искать можно и по-русски, и по-украински.

let indexPromise = null

const normalize = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[’'ʼ`]/g, '')

/** Загружает справочник один раз; повторные вызовы получают тот же промис. */
export function loadPlaces() {
  indexPromise ??= fetch(`${import.meta.env.BASE_URL}places-ua.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`places-ua.json: HTTP ${res.status}`)
      return res.json()
    })
    .then(({ regions, places }) => {
      const list = places.map(([ru, uk, region, lat, lon, population, near, nearKm], id) => ({
        id,
        name: ru,
        nameUk: uk,
        region: regions[region] ?? '',
        lat,
        lon,
        population,
        nearIdx: near,
        nearKm,
        keys: [normalize(ru), ...(uk ? [normalize(uk)] : [])],
      }))
      for (const p of list) p.nearName = p.nearIdx >= 0 ? list[p.nearIdx].name : ''
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

/** Подпись под названием: «Донецкая обл. · 13 км от Славянска». */
export function placeSubtitle(p) {
  const parts = [p.region]
  if (p.nearName && p.nearKm > 0) parts.push(`${p.nearKm} км от г. ${p.nearName}`)
  else if (p.population >= 10000) parts.push(`${p.population.toLocaleString('ru-RU')} жит.`)
  return parts.filter(Boolean).join(' · ')
}
