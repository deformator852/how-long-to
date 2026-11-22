<script setup>
import { onMounted, ref, watch } from 'vue'
import { t } from '../i18n'
import { placeName, placeSubtitle, searchPlaces, topPlaces } from '../services/places'

const model = defineModel({ type: Object, default: null })
defineProps({ label: { type: String, required: true }, icon: { type: String, default: undefined } })

// Список подгружается порциями: дошли до конца прокрутки — догружаем следующую.
const PAGE = 30

const search = ref('')
const items = ref([])
const loading = ref(false)
const failed = ref(false)
const hasMore = ref(false)

let query = '' // что сейчас показано: '' — крупнейшие пункты, иначе результаты поиска
let limit = PAGE

// Выбранный пункт должен оставаться в списке, иначе поле очистится.
const withModel = (list) => (model.value && !list.some((p) => p.id === model.value.id) ? [model.value, ...list] : list)

/** Загружает первые `limit` пунктов для текущего `query`. */
async function load() {
  const q = query
  try {
    const found = q ? await searchPlaces(q, limit) : await topPlaces(limit)
    if (q !== query) return // пока искали, ввели другое
    items.value = withModel(found)
    hasMore.value = found.length >= limit
    failed.value = false
  } catch {
    failed.value = true
    hasMore.value = false
  }
}

function setQuery(q) {
  query = q
  limit = PAGE
  return load()
}

function loadMore(isIntersecting) {
  if (!isIntersecting || !hasMore.value) return
  limit += PAGE
  load()
}

onMounted(async () => {
  loading.value = true
  // Без ввода стрелка раскрывает список крупнейших пунктов.
  await setQuery('')
  loading.value = false
})

let timer = null
watch(search, (q) => {
  clearTimeout(timer)
  // Vuetify пишет в search название выбранного пункта — повторно не ищем.
  if (q && q === placeName(model.value)) return
  if (!q || q.trim().length < 2) {
    setQuery('')
    return
  }
  timer = setTimeout(() => setQuery(q), 120)
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
    hide-details="auto"
    variant="outlined"
    :placeholder="t('placeholder')"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" :subtitle="placeSubtitle(item)" lines="two" />
    </template>
    <template v-if="hasMore" #append-item>
      <div v-intersect="loadMore" class="d-flex justify-center py-2">
        <v-progress-circular indeterminate size="20" width="2" />
      </div>
    </template>
  </v-autocomplete>
</template>
