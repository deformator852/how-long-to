<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFlightStore } from '../stores/flight'
import { flightMinutes, formatDuration } from '../utils/flight'
import { placeName } from '../services/places'
import { NUMBER_LOCALE, t } from '../i18n'

const { results, distanceKm, points, legsKm } = storeToRefs(useFlightStore())

const km = (v) => Math.round(v).toLocaleString(NUMBER_LOCALE)

/** «Герань-2 (Shahed-136)» → «Герань-2»: в шапке таблицы мало места. */
const shortTitle = (key) => t(`${key}.title`).replace(/\s*\(.*\)$/, '')

/** Расстояние от старта до каждой точки цепочки, км (у первой — 0). */
const cumKm = computed(() => {
  let sum = 0
  return [0, ...legsKm.value.map((d) => (sum += d))]
})

const beyondRange = (r, i) => r.rangeKm != null && cumKm.value[i] > r.rangeKm
</script>

<template>
  <v-card v-if="results.length" variant="tonal" color="primary" class="pa-2">
    <v-card-item>
      <v-card-subtitle>{{ t('resultTitle') }}</v-card-subtitle>
      <v-chip prepend-icon="mdi-map-marker-distance" variant="outlined" class="mt-2">
        {{ km(distanceKm) }} {{ points.length > 2 ? t('kmRoute') : t('kmStraight') }}
      </v-chip>
    </v-card-item>

    <v-card-text class="pt-0">
      <div v-for="(r, i) in results" :key="r.key" :class="{ 'border-t pt-3': i > 0 }" class="mt-3">
        <div class="d-flex align-center flex-wrap ga-2">
          <v-icon :icon="r.icon" />
          <span class="text-title-medium">{{ t(`${r.key}.title`) }}</span>
          <span class="text-body-medium text-medium-emphasis">{{ km(r.speedKmh) }} {{ t('kmh') }}</span>
        </div>
        <div class="font-weight-bold" :class="results.length === 1 ? 'text-display-medium' : 'text-headline-large'">
          {{ formatDuration(r.minutes) }}
        </div>
        <div v-if="r.outOfRange" class="text-body-small text-warning">
          <v-icon icon="mdi-alert" size="small" /> {{ t('outOfRange', { km: km(r.rangeKm) }) }}
        </div>
      </div>
    </v-card-text>

    <v-card-text v-if="points.length > 2" class="pt-0">
      <div class="text-title-small mt-2 mb-1">{{ t('byPoints') }}</div>
      <v-table density="compact" class="legs-table bg-transparent">
        <thead>
          <tr>
            <th>#</th>
            <th>{{ t('point') }}</th>
            <th class="text-end">{{ t('km') }}</th>
            <th v-for="r in results" :key="r.key" class="text-end text-no-wrap">{{ shortTitle(r.key) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in points" :key="i">
            <td class="font-weight-bold">{{ i + 1 }}</td>
            <td>{{ placeName(p) }}</td>
            <td class="text-end text-no-wrap">
              {{ km(cumKm[i]) }}
              <div v-if="i > 1" class="text-body-small text-medium-emphasis">+{{ km(legsKm[i - 1]) }}</div>
            </td>
            <td
              v-for="r in results"
              :key="r.key"
              class="text-end text-no-wrap"
              :class="{ 'text-warning': beyondRange(r, i) }"
            >
              {{ i > 0 ? formatDuration(flightMinutes(cumKm[i], r.speedKmh)) : '—' }}
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>

<style scoped>
/* Колонок может быть много (по одной на аппарат) — ужимаем отступы, чтобы влезало на телефон. */
.legs-table :deep(th),
.legs-table :deep(td) {
  padding: 4px 6px !important;
}
</style>
