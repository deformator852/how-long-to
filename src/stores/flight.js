import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { haversineKm } from '../utils/geo.js'
import { VEHICLES, flightMinutes } from '../utils/flight'

const HISTORY_KEY = 'distance-count:history'
const HISTORY_LIMIT = 8

function loadHistory() {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY)) ?? []
    return h
      .filter((e) => typeof e.from?.id === 'number') // записи до перехода на локальный справочник
      .map((e) => ({ ...e, vehicles: (e.vehicles ?? [e.vehicle]).filter((v) => VEHICLES[v]) }))
      .filter((e) => e.vehicles.length)
  } catch {
    return []
  }
}

export const useFlightStore = defineStore('flight', () => {
  const from = ref(null)
  const to = ref(null)
  const vehicles = ref(['banderol'])
  const customSpeedKmh = ref(VEHICLES.custom.maxSpeedKmh)
  const history = ref(loadHistory())

  const distanceKm = computed(() => (from.value && to.value ? haversineKm(from.value, to.value) : null))

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

  function swap() {
    ;[from.value, to.value] = [to.value, from.value]
  }

  function restore(entry) {
    from.value = entry.from
    to.value = entry.to
    vehicles.value = [...entry.vehicles]
  }

  watch([from, to], () => {
    if (!from.value || !to.value) return
    const key = `${from.value.id}-${to.value.id}`
    history.value = [
      { key, from: from.value, to: to.value, vehicles: [...vehicles.value] },
      ...history.value.filter((h) => h.key !== key),
    ].slice(0, HISTORY_LIMIT)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
    } catch {
      /* приватный режим — не сохраняем */
    }
  })

  return { from, to, vehicles, customSpeedKmh, history, distanceKm, results, swap, restore }
})
