<script setup>
import { storeToRefs } from 'pinia'
import PlaceAutocomplete from './components/PlaceAutocomplete.vue'
import EstimateResult from './components/EstimateResult.vue'
import { watchEffect } from 'vue'
import { useLocale } from 'vuetify'
import { useFlightStore } from './stores/flight'
import { VEHICLES } from './utils/flight'
import { lang, t } from './i18n'
import { placeName } from './services/places'

const { current: vuetifyLocale } = useLocale()
watchEffect(() => {
  vuetifyLocale.value = lang.value
  document.title = t('appTitle')
})

const CONTACTS = [
  { label: 'kostneko30@gmail.com', href: 'mailto:kostneko30@gmail.com', icon: 'mdi-email-outline' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/nikita-kostenko141/', icon: 'mdi-linkedin' },
  { label: 'GitHub', href: 'https://github.com/deformator852', icon: 'mdi-github' },
]

const store = useFlightStore()
const { from, to, vehicles, customSpeedKmh, history, results } = storeToRefs(store)
</script>

<template>
  <v-app>
    <v-app-bar color="primary" flat>
      <v-app-bar-title>
        <v-icon icon="mdi-timer-outline" class="mr-2" />{{ t('appTitle') }}
      </v-app-bar-title>
      <template #append>
        <v-btn-toggle v-model="lang" mandatory density="compact" variant="outlined" divided class="mr-2" color="white">
          <v-btn value="uk" size="small">УКР</v-btn>
          <v-btn value="ru" size="small">РУС</v-btn>
        </v-btn-toggle>
      </template>
    </v-app-bar>

    <v-main>
      <v-container class="py-8" style="max-width: 760px">
        <v-card class="pa-4 mb-6">
          <PlaceAutocomplete v-model="from" :label="t('from')" icon="mdi-map-marker-outline" />

          <div class="d-flex justify-center my-n2">
            <v-btn icon="mdi-swap-vertical" variant="text" :title="t('swap')" @click="store.swap" />
          </div>

          <PlaceAutocomplete v-model="to" :label="t('to')" icon="mdi-map-marker-check-outline" />

          <v-chip-group v-model="vehicles" multiple mandatory selected-class="text-primary" column class="mt-2">
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
        </v-card>

        <EstimateResult />

        <v-alert v-if="!results.length" type="info" variant="tonal" icon="mdi-information-outline">
          {{ t('emptyHint') }}
        </v-alert>

        <template v-if="history.length">
          <div class="text-title-medium mt-8 mb-2">{{ t('recent') }}</div>
          <div class="d-flex flex-wrap ga-2">
            <v-chip v-for="h in history" :key="h.key" :prepend-icon="VEHICLES[h.vehicles[0]].icon" @click="store.restore(h)">
              {{ placeName(h.from) }} → {{ placeName(h.to) }}
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
