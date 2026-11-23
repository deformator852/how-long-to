<script setup>
// Страница «Наскільки точний застосунок»: хронология постов мониторингового канала и расчёт приложения
// для тех же точек — тем же кодом, что и основной расчёт (haversineKm + flightMinutes).
// «Перевірити самому» раскрывает в примере полноценный калькулятор с этим маршрутом — отдельный экземпляр,
// главную страницу и её историю он не трогает.
import { computed, effectScope, onMounted, onScopeDispose, reactive, ref, shallowReactive } from 'vue'
import FlightCalculator from './FlightCalculator.vue'
import { createFlight } from '../composables/flight'
import { REAL_CASES, SOURCES } from '../data/realCases'
import { loadPlaces, placeName } from '../services/places'
import { haversineKm } from '../utils/geo'
import { VEHICLES, flightMinutes, formatDuration } from '../utils/flight'
import { NUMBER_LOCALE, t } from '../i18n'

const places = ref(null) // Map id → пункт; null — справочник ещё не загружен (или не загрузился)

onMounted(async () => {
  try {
    const ids = new Set(REAL_CASES.flatMap((c) => c.events.map((e) => e.point).filter(Boolean)))
    const list = await loadPlaces()
    places.value = new Map(list.filter((p) => ids.has(p.id)).map((p) => [p.id, p]))
  } catch {
    /* без справочника остаётся хронология постов, без расчёта */
  }
})

const TZ = 'Europe/Kyiv'
const timeFmt = new Intl.DateTimeFormat(NUMBER_LOCALE, { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dateFmt = new Intl.DateTimeFormat(NUMBER_LOCALE, { timeZone: TZ, day: 'numeric', month: 'long' })

const shortTitle = (key) => t(`${key}.title`).replace(/\s*\(.*\)$/, '')
const km = (v) => v.toLocaleString(NUMBER_LOCALE, { maximumFractionDigits: 1 })

function build(c) {
  // Точки маршрута — посты, где названо пройденное село; реальное время — от первой из них до последней.
  const route = c.events.filter((e) => e.point)
  const t0 = Date.parse(route[0].at)
  const realMin = (Date.parse(route.at(-1).at) - t0) / 60000

  const points = route.map((e) => places.value?.get(e.point))
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

const cases = computed(() => REAL_CASES.map(build))
const openPanels = ref([REAL_CASES[0].id]) // первый (самый показательный) пример раскрыт сразу

// Калькуляторы примеров создаются при первом «Перевірити самому» и живут, пока открыта страница
// (свернуть и развернуть — правки сохраняются). Отдельный scope — чтобы их computed удалились вместе со страницей.
const labScope = effectScope()
onScopeDispose(() => labScope.stop())
const labs = shallowReactive({}) // id примера → экземпляр createFlight()
const shown = reactive({}) // id примера → калькулятор раскрыт

const initialRoute = (c) => ({ points: c.points, vehicles: c.vehicles })

function toggleLab(c) {
  labs[c.id] ??= labScope.run(() => createFlight(initialRoute(c)))
  shown[c.id] = !shown[c.id]
}

function verdict(c) {
  const diff = formatDuration(Math.abs(c.realMin - c.closest.minutes))
  const name = shortTitle(c.closest.key)
  return c.realMin >= c.closest.minutes ? t('casesLonger', { diff, name }) : t('casesShorter', { diff, name })
}
</script>

<template>
  <v-card>
    <v-card-item>
      <v-card-title class="text-title-large cases-wrap">{{ t('casesTitle') }}</v-card-title>
      <v-card-subtitle class="cases-wrap">{{ t('casesHint') }}</v-card-subtitle>
    </v-card-item>

    <v-expansion-panels v-model="openPanels" variant="accordion" multiple class="px-4">
      <v-expansion-panel v-for="c in cases" :key="c.id" :value="c.id">
        <v-expansion-panel-title>
          <div class="d-flex flex-column ga-1">
            <div class="text-title-small">{{ c.title }}</div>
            <div class="text-body-small text-medium-emphasis">{{ c.date }} · {{ c.target }}</div>
            <div class="d-flex flex-wrap ga-2 mt-1">
              <v-chip size="small" variant="tonal" prepend-icon="mdi-clock-outline">
                {{ t('casesReal') }}: {{ formatDuration(c.realMin) }}
              </v-chip>
              <v-chip v-if="c.appRange" size="small" variant="tonal" color="primary" prepend-icon="mdi-calculator-variant-outline">
                {{ t('casesApp') }}: {{ c.appRange }}
              </v-chip>
            </div>
          </div>
        </v-expansion-panel-title>

        <v-expansion-panel-text>
          <ol class="case-events">
            <li v-for="e in c.events" :key="e.post" :class="{ 'case-event--measured': e.measured }">
              <div class="d-flex flex-wrap align-baseline ga-2">
                <span class="font-weight-bold">{{ e.time }}</span>
                <span v-if="e.offset" class="text-body-small text-medium-emphasis">{{ e.offset }}</span>
                <span v-if="e.appAt" class="text-body-small text-primary">
                  {{ t('casesAppAt', { name: shortTitle(c.closest.key), time: e.appAt }) }}
                </span>
                <a :href="e.url" target="_blank" rel="noopener" class="text-body-small">{{ e.source }}</a>
              </div>
              <div class="text-body-medium">{{ e.text }}</div>
            </li>
          </ol>

          <v-sheet v-if="c.points" color="surface-light" rounded class="pa-3 mt-3 text-body-medium">
            <div>
              {{ c.points.map(placeName).join(' → ') }}:
              <b>{{ km(c.distanceKm) }} {{ c.points.length > 2 ? t('kmRoute') : t('kmStraight') }}</b>
            </div>
            <div>{{ t('casesElapsed') }}: <b>{{ formatDuration(c.realMin) }}</b></div>
            <div v-for="e in c.estimates" :key="e.key">
              {{ t('casesEstimate', { name: shortTitle(e.key), speed: e.speedKmh }) }}: <b>{{ formatDuration(e.minutes) }}</b>
            </div>
            <div class="mt-2">{{ verdict(c) }}</div>
            <div v-if="c.note" class="mt-2 text-medium-emphasis">{{ c.note }}</div>
          </v-sheet>

          <div class="d-flex flex-wrap ga-2 mt-3">
            <v-btn
              :prepend-icon="shown[c.id] ? 'mdi-chevron-up' : 'mdi-play-circle-outline'"
              :variant="shown[c.id] ? 'tonal' : 'flat'"
              color="primary"
              :disabled="!c.points"
              @click="toggleLab(c)"
            >
              {{ shown[c.id] ? t('labHide') : t('labShow') }}
            </v-btn>
            <v-btn
              v-if="shown[c.id]"
              prepend-icon="mdi-restore"
              variant="text"
              @click="labs[c.id].restore(initialRoute(c))"
            >
              {{ t('labReset') }}
            </v-btn>
          </div>

          <div v-if="shown[c.id]" class="mt-4">
            <v-alert type="info" variant="tonal" density="compact" icon="mdi-clock-outline" class="mb-4">
              {{ t('labHint', { real: formatDuration(c.realMin) }) }}
            </v-alert>
            <FlightCalculator :flight="labs[c.id]" />
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-card-text class="text-body-small text-medium-emphasis">{{ t('casesMethod') }}</v-card-text>
  </v-card>
</template>

<style scoped>
.cases-wrap {
  white-space: normal;
}

/* Хронология: вертикальная линия слева, посты, между которыми считаем время, — с акцентной точкой. */
.case-events {
  list-style: none;
  margin: 0;
  padding: 0 0 0 18px;
  border-left: 2px solid rgba(var(--v-theme-on-surface), 0.15);
}

.case-events li {
  position: relative;
  padding: 0 0 12px;
}

.case-events li::before {
  content: '';
  position: absolute;
  left: -24px;
  top: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgb(var(--v-theme-surface));
  border: 2px solid rgba(var(--v-theme-on-surface), 0.4);
}

.case-events li.case-event--measured::before {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
}
</style>
