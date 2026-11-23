<script setup>
// Калькулятор целиком: цепочка точек (списком или кликами по карте), выбор аппаратов, результат и 3D-карта.
// Состояние — в экземпляре createFlight(), который передают пропом: на главной — с историей маршрутов,
// на странице точности — отдельный для каждого примера. Слот — дополнительное содержимое под результатом
// (в той же колонке, что и форма).
import { computed, defineAsyncComponent, nextTick, ref, toRefs } from 'vue'
import { useDisplay } from 'vuetify'
import PlaceAutocomplete from './PlaceAutocomplete.vue'
import PointBadge from './PointBadge.vue'
import EstimateResult from './EstimateResult.vue'
import { provideFlight } from '../composables/flight'
import { VEHICLES } from '../utils/flight'
import { placeName } from '../services/places'
import { t } from '../i18n'

// Leaflet грузится отдельным чанком — только когда открывают режим «Карта».
const RouteMap = defineAsyncComponent(() => import('./RouteMap.vue'))
// MapLibre (~1,6 МБ вместе с воркером) — тоже отдельным чанком, только для 3D-вида в режиме «Список».
const Route3D = defineAsyncComponent(() => import('./Route3D.vue'))

const props = defineProps({
  flight: { type: Object, required: true }, // экземпляр createFlight()
  side: { type: Boolean, default: false }, // на широком экране 3D-карта — отдельной колонкой слева
})
const mode = defineModel('mode', { type: String, default: 'list' }) // 'list' — поля с поиском, 'map' — клики по карте

const flight = props.flight
provideFlight(flight)
const { stops, filledStops, vehicles, customSpeedKmh, results } = toRefs(flight)

const { lgAndUp } = useDisplay()
const sideMap = computed(() => props.side && mode.value === 'list' && lgAndUp.value)
const routeMap = ref(null)
const autofocusKey = ref(null)

const stopLabel = (i) => (i === 0 ? t('from') : i === stops.value.length - 1 ? t('to') : t('via'))

function addStop() {
  flight.addStop()
  autofocusKey.value = stops.value.at(-1).key
}

/** Подогнать карту режима «Карта» под маршрут (после восстановления маршрута из истории). */
async function fitMap() {
  await nextTick()
  routeMap.value?.fit()
}

defineExpose({ fitMap })
</script>

<template>
  <div :class="{ 'layout-side': sideMap }">
    <aside v-if="sideMap" class="layout-side__map">
      <Route3D side />
    </aside>
    <div class="layout-side__main">
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
                <PointBadge :index="i" :size="26" />
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
                @click="flight.removeStop(s.key)"
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
                @click:close="flight.removeStop(s.key)"
              >
                <PointBadge :index="i" :size="18" class="mr-1 ml-n1" />{{ placeName(s.place) }}
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
              @click="flight.removeLastPoint"
            >
              {{ t('undo') }}
            </v-btn>
            <v-spacer />
            <v-btn prepend-icon="mdi-swap-vertical" variant="text" :title="t('reverseHint')" @click="flight.reverse">
              {{ t('reverse') }}
            </v-btn>
            <v-btn
              prepend-icon="mdi-delete-outline"
              variant="text"
              :disabled="!filledStops.length && stops.length <= 2"
              @click="flight.clear"
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

      <Route3D v-if="!sideMap && mode === 'list' && filledStops.length >= 2" class="mt-6" />

      <v-alert v-if="!results.length" type="info" variant="tonal" icon="mdi-information-outline">
        {{ t('emptyHint') }}
      </v-alert>

      <slot />
    </div>
  </div>
</template>

<style scoped>
.layout-side {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 24px;
  align-items: start;
}

/* Карта не уезжает при прокрутке правой колонки и занимает всю высоту окна под шапкой. */
.layout-side__map {
  position: sticky;
  top: calc(var(--v-layout-top, 64px) + 32px);
  height: calc(100dvh - var(--v-layout-top, 64px) - 64px);
  min-height: 420px;
}

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
</style>
