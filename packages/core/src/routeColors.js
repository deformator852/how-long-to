// Цвета приложения и маршрута — одни для веба и мобильного. scheme — 'light' или 'dark'.
// У каждого отрезка маршрута свой цвет, точка красится цветом отрезка, который в неё ведёт,
// старт — цветом secondary. Порядок цветов отрезков — по контрасту с соседями.

export const THEME_COLORS = {
  light: { primary: '#1f5fbf', secondary: '#e8772e' },
  dark: { primary: '#7aa7ff', secondary: '#ffa36b' },
}

const LEG_PALETTES = {
  light: ['#1f5fbf', '#2e7d32', '#8e24aa', '#d32f2f', '#00838f', '#c2185b', '#6d4c41', '#827717'],
  dark: ['#7aa7ff', '#6fcf73', '#d18cf0', '#ff6b6b', '#4dd0e1', '#f78fb3', '#ffd54f', '#c8a27a'],
}

/** Цвет отрезка №leg (0 — от первой точки ко второй); после восьмого цвета идут по кругу. */
export const legColor = (leg, scheme = 'light') => LEG_PALETTES[scheme][leg % LEG_PALETTES[scheme].length]

/** Цвет точки №index (0 — старт). */
export const pointColor = (index, scheme = 'light') => (index === 0 ? THEME_COLORS[scheme].secondary : legColor(index - 1, scheme))

// Контраст по APCA — тот же расчёт, которым Vuetify выбирал цвет текста на цветном фоне
// (белый, если он хоть сколько-нибудь читается), чтобы вид не изменился при переходе с Vue.
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
const Y = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => c ** 2.4)
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  return y <= 0.03 ? y + (0.03 - y) ** 1.45 : y
}

/** Контраст текста `text` на фоне `bg` по APCA (Lc, по модулю 0…~106). */
function apca(text, bg) {
  const [yt, yb] = [Y(text), Y(bg)]
  if (Math.abs(yb - yt) < 0.0005) return 0
  const sapc = yb > yt ? (yb ** 0.55 - yt ** 0.58) * 1.25 : (yb ** 0.62 - yt ** 0.57) * 1.25
  const lowClip = Math.abs(sapc) < 0.001
  if (lowClip) return 0
  const lc = Math.abs(sapc) < 0.078 ? Math.abs(sapc) * (1 - 0.06 / 0.078) : Math.abs(sapc) - 0.06
  return lc * 100
}

/** Белый или чёрный текст на фоне `hex`: белый, если его контраст больше min(контраст чёрного, 50). */
export function contrastText(hex) {
  return apca('#ffffff', hex) > Math.min(apca('#000000', hex), 50) ? '#ffffff' : '#000000'
}

/** Цвета кружка с номером точки: { background, color }. */
export function pinColors(index, scheme = 'light') {
  const background = pointColor(index, scheme)
  return { background, color: contrastText(background) }
}
