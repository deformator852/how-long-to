<script setup>
import { onMounted, ref, watch } from 'vue'
import { loadPlaces, placeSubtitle, searchPlaces } from '../services/places'

const model = defineModel({ type: Object, default: null })
defineProps({ label: { type: String, required: true }, icon: { type: String, default: 'mdi-map-marker' } })

const search = ref('')
const items = ref([])
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  loading.value = true
  try {
    await loadPlaces()
  } catch {
    error.value = 'Не удалось загрузить справочник населённых пунктов. Обновите страницу.'
  } finally {
    loading.value = false
  }
})

let timer = null
watch(search, (q) => {
  clearTimeout(timer)
  // Vuetify пишет в search название выбранного пункта — повторно не ищем.
  if (!q || q === model.value?.name) return
  timer = setTimeout(async () => {
    try {
      const found = await searchPlaces(q)
      // Выбранный пункт должен оставаться в списке, иначе поле очистится.
      items.value = model.value && !found.some((p) => p.id === model.value.id) ? [model.value, ...found] : found
      error.value = ''
    } catch {
      error.value = 'Не удалось загрузить справочник населённых пунктов. Обновите страницу.'
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
    :error-messages="error"
    item-title="name"
    item-value="id"
    return-object
    no-filter
    clearable
    hide-no-data
    variant="outlined"
    placeholder="Начните вводить название…"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" :subtitle="placeSubtitle(item)" />
    </template>
  </v-autocomplete>
</template>
