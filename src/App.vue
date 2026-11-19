<script setup>
import { storeToRefs } from 'pinia'
import PlaceAutocomplete from './components/PlaceAutocomplete.vue'
import EstimateResult from './components/EstimateResult.vue'
import { defineAsyncComponent, nextTick, ref } from 'vue'
import { useFlightStore } from './stores/flight'
import { VEHICLES } from './utils/flight'
import { t } from './i18n'
import { placeName } from './services/places'

const CONTACTS = [
  { label: 'kostneko30@gmail.com', href: 'mailto:kostneko30@gmail.com', icon: 'mdi-email-outline' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/nikita-kostenko141/', icon: 'mdi-linkedin' },
  { label: 'GitHub', href: 'https://github.com/deformator852', icon: 'mdi-github' },
]

// Leaflet грузится отдельным чанком — только когда открывают режим «Карта».
const RouteMap = defineAsyncComponent(() => import('./components/RouteMap.vue'))
// MapLibre (~1,6 МБ вместе с воркером) — тоже отдельным чанком, только для 3D-вида в режиме «Список».
const Route3D = defineAsyncComponent(() => import('./components/Route3D.vue'))

const store = useFlightStore()
const { stops, filledStops, vehicles, customSpeedKmh, history, results } = storeToRefs(store)

const mode = ref('list') // 'list' — поля с поиском пунктов, 'map' — точки кликами по карте
const routeMap = ref(null)
const autofocusKey = ref(null)

const stopLabel = (i) => (i === 0 ? t('from') : i === stops.value.length - 1 ? t('to') : t('via'))

function addStop() {
  store.addStop()
  autofocusKey.value = stops.value.at(-1).key
}

async function restore(entry) {
  store.restore(entry)
  await nextTick()
  routeMap.value?.fit()
}

function routeLabel(points) {
  const names = points.map(placeName)
  return names.length <= 3 ? names.join(' → ') : `${names[0]} → … → ${names.at(-1)}`
}
</script>

<template>
  <v-app>
    <v-app-bar color="primary" flat>
      <v-app-bar-title>
        <v-icon icon="mdi-timer-outline" class="mr-2" />{{ t('appTitle') }}
      </v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container class="py-8" style="max-width: 760px">
        <v-card class="mb-6">
          <v-tabs v-model="mode" grow color="primary">
            <v-tab value="list" prepend-icon="mdi-format-list-numbered">{{ t('modeList') }}</v-tab>
            <v-tab value="map" prepend-icon="mdi-map-marker-path">{{ t('modeMap') }}</v-tab>
          </v-tabs>
          <v-divider />

          <div class="pa-4">
            <div v-if="mode === 'list'" class="stops">
              <div v-for="(s, i) in stops" :key="s.key" class="stop-row">
                <div class="stop-rail">
                  <span class="stop-num" :class="{ 'stop-num--start': i === 0 }">{{ i + 1 }}</span>
                </div>
                <PlaceAutocomplete
                  v-model="s.place"
                  :label="stopLabel(i)"
                  :autofocus="s.key === autofocusKey"
                  class="flex-grow-1"
                />
                <v-btn
                  v-if="stops.length > 2"
                  icon="mdi-close"
                  variant="text"
                  size="small"
                  class="align-self-center"
                  :title="t('removePoint')"
                  :aria-label="t('removePoint')"
                  @click="store.removeStop(s.key)"
                />
              </div>
            </div>

            <template v-else>
              <div class="text-body-small text-medium-emphasis mb-2">{{ t('mapHint') }}</div>
              <RouteMap ref="routeMap" />
              <div v-if="filledStops.length" class="d-flex flex-wrap ga-2 mt-3">
                <v-chip
                  v-for="(s, i) in filledStops"
                  :key="s.key"
                  size="small"
                  closable
                  :close-label="t('removePoint')"
                  @click:close="store.removeStop(s.key)"
                >
                  <span class="font-weight-bold mr-1">{{ i + 1 }}</span>{{ placeName(s.place) }}
                </v-chip>
              </div>
            </template>

            <div class="d-flex flex-wrap align-center ga-2 mt-3">
              <v-btn v-if="mode === 'list'" prepend-icon="mdi-plus" variant="tonal" @click="addStop">
                {{ t('addPoint') }}
              </v-btn>
              <v-btn
                v-else
                prepend-icon="mdi-undo"
                variant="tonal"
                :disabled="!filledStops.length"
                :title="t('undoHint')"
                @click="store.removeLastPoint"
              >
                {{ t('undo') }}
              </v-btn>
              <v-spacer />
              <v-btn prepend-icon="mdi-swap-vertical" variant="text" :title="t('reverseHint')" @click="store.reverse">
                {{ t('reverse') }}
              </v-btn>
              <v-btn
                prepend-icon="mdi-delete-outline"
                variant="text"
                :disabled="!filledStops.length && stops.length <= 2"
                @click="store.clear"
              >
                {{ t('clear') }}
              </v-btn>
            </div>

            <v-divider class="mt-4 mb-2" />

            <v-chip-group v-model="vehicles" multiple mandatory selected-class="text-primary" column>
              <v-chip v-for="(v, key) in VEHICLES" :key="key" :value="key" :prepend-icon="v.icon" variant="outlined" filter>
                {{ t(`${key}.title`) }}
              </v-chip>
            </v-chip-group>
            <div class="text-body-small text-medium-emphasis mt-1">{{ t('multiHint') }}</div>
            <ul class="text-body-small text-medium-emphasis mt-1 pl-4">
              <li v-for="key in vehicles" :key="key">{{ t(`${key}.title`) }}: {{ t(`${key}.note`) }}</li>
            </ul>

            <v-text-field
              v-if="vehicles.includes('custom')"
              v-model.number="customSpeedKmh"
              type="number"
              min="1"
              :label="t('speed')"
              :suffix="t('kmh')"
              prepend-inner-icon="mdi-speedometer"
              variant="outlined"
              class="mt-4"
              hide-details
            />
          </div>
        </v-card>

        <EstimateResult />

        <Route3D v-if="mode === 'list' && filledStops.length >= 2" />

        <v-alert v-if="!results.length" type="info" variant="tonal" icon="mdi-information-outline">
          {{ t('emptyHint') }}
        </v-alert>

        <template v-if="history.length">
          <div class="text-title-medium mt-8 mb-2">{{ t('recent') }}</div>
          <div class="d-flex flex-wrap ga-2">
            <v-chip
              v-for="h in history"
              :key="h.key"
              :prepend-icon="VEHICLES[h.vehicles[0]].icon"
              :title="h.points.map(placeName).join(' → ')"
              @click="restore(h)"
            >
              {{ routeLabel(h.points) }}
            </v-chip>
          </div>
        </template>

        <p class="text-body-small text-medium-emphasis mt-8">
          {{ t('disclaimer') }}
          <a href="https://www.geonames.org" target="_blank" rel="noopener">GeoNames</a>
          (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>).
        </p>
      </v-container>
    </v-main>

    <v-footer class="justify-center flex-column flex-grow-0 ga-2 py-6" color="surface-light">
      <div class="d-flex flex-wrap justify-center ga-2">
        <v-btn
          v-for="c in CONTACTS"
          :key="c.href"
          :href="c.href"
          :prepend-icon="c.icon"
          :target="c.href.startsWith('http') ? '_blank' : undefined"
          rel="noopener"
          variant="text"
          size="small"
          class="text-none"
        >
          {{ c.label }}
        </v-btn>
      </div>
      <div class="text-body-small text-medium-emphasis">{{ t('contact') }}</div>
    </v-footer>
  </v-app>
</template>

<style scoped>
.stops {
  --stop-gap: 12px;
  display: flex;
  flex-direction: column;
  gap: var(--stop-gap);
}

.stop-row {
  display: flex;
  gap: 8px;
}

/* Колонка с номером точки; пунктир от номера к номеру показывает, что точки — одна цепочка. */
.stop-rail {
  position: relative;
  display: flex;
  align-items: center;
}

.stop-row:not(:last-child) .stop-rail::after {
  content: '';
  position: absolute;
  top: calc(50% + 17px);
  left: 12px;
  height: calc(100% - 34px + var(--stop-gap));
  border-left: 2px dotted rgba(var(--v-theme-on-surface), 0.3);
}

.stop-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 13px;
  font-weight: 600;
}

.stop-num--start {
  background: rgb(var(--v-theme-secondary));
  color: rgb(var(--v-theme-on-secondary));
}
</style>
