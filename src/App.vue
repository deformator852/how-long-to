<script setup>
import { computed, ref } from 'vue'
import { useDisplay } from 'vuetify'
import FlightCalculator from './components/FlightCalculator.vue'
import RealCases from './components/RealCases.vue'
import { createFlight } from './composables/flight'
import { VEHICLES } from './utils/flight'
import { t } from './i18n'
import { placeName } from './services/places'

const SOURCE_URL = 'https://github.com/deformator852/how-long-to'

const CONTACTS = [
  { label: 'kostneko30@gmail.com', href: 'mailto:kostneko30@gmail.com', icon: 'mdi-email-outline' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/nikita-kostenko141/', icon: 'mdi-linkedin' },
  { label: 'GitHub', href: 'https://github.com/deformator852', icon: 'mdi-github' },
]

// Калькулятор главной страницы — единственный, кто ведёт «Нещодавні маршрути».
const flight = createFlight({ persistHistory: true })
const calculator = ref(null)
const mode = ref('list') // режим калькулятора главной: 'list' или 'map'

// Страница «Наскільки точний застосунок» — по адресу #accuracy (ссылкой можно делиться), назад — кнопкой браузера.
const pageFromUrl = () => (location.hash === '#accuracy' ? 'accuracy' : 'main')
const page = ref(pageFromUrl())
window.addEventListener('popstate', () => (page.value = pageFromUrl()))

function go(to) {
  if (page.value === to) return
  window.history.pushState(null, '', to === 'accuracy' ? '#accuracy' : location.pathname + location.search)
  page.value = to
  window.scrollTo({ top: 0 })
}

// На широком экране в режиме «Список» 3D-карта стоит слева от формы — странице нужна большая ширина.
const { lgAndUp, smAndUp } = useDisplay()
const wide = computed(() => mode.value === 'list' && lgAndUp.value)

function restore(entry) {
  flight.restore(entry)
  calculator.value?.fitMap()
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
      <template #append>
        <v-btn
          href="#accuracy"
          prepend-icon="mdi-check-decagram-outline"
          :variant="page === 'accuracy' ? 'tonal' : 'text'"
          class="text-none"
          @click.prevent="go('accuracy')"
        >
          {{ smAndUp ? t('accuracyLink') : t('accuracyLinkShort') }}
        </v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <v-container v-if="page === 'accuracy'" class="py-8" style="max-width: 760px">
        <v-btn href="./" prepend-icon="mdi-arrow-left" variant="text" class="text-none mb-4" @click.prevent="go('main')">
          {{ t('backToCalc') }}
        </v-btn>
        <RealCases />
      </v-container>

      <v-container v-else class="py-8" :style="{ maxWidth: wide ? '1600px' : '760px' }">
        <FlightCalculator ref="calculator" v-model:mode="mode" :flight="flight" side>
          <template v-if="flight.history.length">
            <div class="text-title-medium mt-8 mb-2">{{ t('recent') }}</div>
            <div class="d-flex flex-wrap ga-2">
              <v-chip
                v-for="h in flight.history"
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
        </FlightCalculator>
      </v-container>
    </v-main>

    <v-footer class="justify-center flex-column flex-grow-0 ga-2 py-6" color="surface-light">
      <v-chip prepend-icon="mdi-cellphone-arrow-down" color="primary" variant="tonal" size="small">
        {{ t('mobileSoon') }}
      </v-chip>
      <div class="d-flex flex-wrap justify-center ga-2">
        <v-btn
          :href="SOURCE_URL"
          prepend-icon="mdi-source-branch"
          target="_blank"
          rel="noopener"
          variant="text"
          size="small"
          class="text-none"
        >
          {{ t('sourceCode') }}
        </v-btn>
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
