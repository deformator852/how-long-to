<script setup>
// Кружок с номером точки маршрута — того же цвета, что точка и ведущий в неё отрезок на картах.
import { pinStyle } from '../utils/routeColors'

const props = defineProps({
  index: { type: Number, required: true }, // 0 — старт
  size: { type: Number, default: 20 },
})
</script>

<template>
  <span
    class="point-badge"
    :style="{ ...pinStyle(props.index), width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size / 2)}px` }"
  >
    {{ index + 1 }}
  </span>
</template>

<style scoped>
.point-badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 600;
  line-height: 1;
}
</style>
