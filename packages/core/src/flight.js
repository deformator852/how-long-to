import { t } from './i18n.js'

// Пресеты скоростей. Цифры — открытые оценки (ГУР/СМИ), официальных ТТХ нет.
// rangeKm — заявленная дальность, используется только для предупреждения.
// Названия и описания — в i18n.js (ключи `<id>.title`, `<id>.note`).
// icon — имя иконки Material Design Icons (https://pictogrammers.com/library/mdi/): в вебе — класс `mdi mdi-<icon>`
// (@mdi/font), в React Native — <MaterialCommunityIcons name={icon} /> из @expo/vector-icons.
export const VEHICLES = {
  banderol: { icon: 'rocket-launch-outline', maxSpeedKmh: 650, rangeKm: 500 },
  geran2: { icon: 'quadcopter', maxSpeedKmh: 185, rangeKm: 2000 },
  geran3: { icon: 'airplane', maxSpeedKmh: 370, rangeKm: 1000 },
  geran4: { icon: 'navigation-variant-outline', maxSpeedKmh: 500, rangeKm: 450 },
  geran5: { icon: 'airplane-takeoff', maxSpeedKmh: 600, rangeKm: 950 },
  custom: { icon: 'speedometer', maxSpeedKmh: 300, rangeKm: null },
}

/** Время полёта по прямой, в минутах. */
export function flightMinutes(distanceKm, speedKmh) {
  return (distanceKm / speedKmh) * 60
}

/** 83.4 → «1 год 23 хв» / «1 ч 23 мин». */
export function formatDuration(minutes) {
  const totalSec = Math.round(minutes * 60)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h} ${t('h')} ${m} ${t('min')}`
  if (m > 0) return s ? `${m} ${t('min')} ${s} ${t('s')}` : `${m} ${t('min')}`
  return `${s} ${t('s')}`
}
