// Цвета маршрута: у каждого отрезка свой цвет, точка красится цветом отрезка, который в неё ведёт,
// старт — цветом secondary темы. Палитры регистрируются как цвета темы Vuetify (leg-1…leg-8), поэтому
// в CSS доступны var(--v-theme-leg-N) и контрастный текст var(--v-theme-on-leg-N) (его Vuetify считает сам),
// а в JS — theme.current.value.colors['leg-N']. Порядок цветов — по контрасту с соседями.
const PALETTES = {
  light: ['#1f5fbf', '#2e7d32', '#8e24aa', '#d32f2f', '#00838f', '#c2185b', '#6d4c41', '#827717'],
  dark: ['#7aa7ff', '#6fcf73', '#d18cf0', '#ff6b6b', '#4dd0e1', '#f78fb3', '#ffd54f', '#c8a27a'],
}

/** Цвета отрезков для темы Vuetify: { 'leg-1': '#…', … }. */
export const legThemeColors = (theme) => Object.fromEntries(PALETTES[theme].map((c, i) => [`leg-${i + 1}`, c]))

/** Имя цвета темы для отрезка №leg (0 — от первой точки ко второй); после восьмого цвета идут по кругу. */
export const legColorName = (leg) => `leg-${(leg % PALETTES.light.length) + 1}`

/** Имя цвета темы для точки №index (0 — старт). */
export const pointColorName = (index) => (index === 0 ? 'secondary' : legColorName(index - 1))

/** Inline-стиль кружка с номером точки: фон — цвет точки, текст — контрастный к нему. */
export function pinStyle(index) {
  const c = pointColorName(index)
  return { background: `rgb(var(--v-theme-${c}))`, color: `rgb(var(--v-theme-on-${c}))` }
}
