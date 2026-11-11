<script setup>
import { onMounted, ref, watch } from 'vue'
import { t } from '../i18n'
import { loadPlaces, placeName, placeSubtitle, searchPlaces } from '../services/places'

const model = defineModel({ type: Object, default: null })
defineProps({ label: { type: String, required: true }, icon: { type: String, default: 'mdi-map-marker' } })

const search = ref('')
const items = ref([])
const loading = ref(false)
const failed = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    await loadPlaces()
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

let timer = null
watch(search, (q) => {
  clearTimeout(timer)
  // Vuetify пишет в search название выбранного пункта — повторно не ищем.
  if (!q || q === placeName(model.value)) return
  timer = setTimeout(async () => {
    try {
      const found = await searchPlaces(q)
      // Выбранный пункт должен оставаться в списке, иначе поле очистится.
      items.value = model.value && !found.some((p) => p.id === model.value.id) ? [model.value, ...found] : found
      failed.value = false
    } catch {
      failed.value = true
    }
  }, 120)
})

watch(model, (v) => {
  if (v && !items.value.some((p) => p.id === v.id)) items.value = [v, ...items.value]
}, { immediate: true })
</script>

<template>
  <v-autocomplete
    v-model="model"
    v-model:search="search"
    :items="items"
    :label="label"
    :prepend-inner-icon="icon"
    :loading="loading"
    :error-messages="failed ? t('loadError') : ''"
    :item-title="placeName"
    item-value="id"
    return-object
    no-filter
    clearable
    hide-no-data
    variant="outlined"
    :placeholder="t('placeholder')"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" :subtitle="placeSubtitle(item)" />
    </template>
  </v-autocomplete>
</template>
