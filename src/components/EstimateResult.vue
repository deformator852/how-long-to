<script setup>
import { storeToRefs } from 'pinia'
import { useFlightStore } from '../stores/flight'
import { formatDuration } from '../utils/flight'
import { numberLocale, t } from '../i18n'

const { results, distanceKm } = storeToRefs(useFlightStore())

const km = (v) => Math.round(v).toLocaleString(numberLocale())
</script>

<template>
  <v-card v-if="results.length" variant="tonal" color="primary" class="pa-2">
    <v-card-item>
      <v-card-subtitle>{{ t('resultTitle') }}</v-card-subtitle>
      <v-chip prepend-icon="mdi-map-marker-distance" variant="outlined" class="mt-2">{{ km(distanceKm) }} {{ t('kmStraight') }}</v-chip>
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
  </v-card>
</template>
