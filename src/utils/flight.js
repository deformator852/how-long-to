import { t } from '../i18n'

// Пресеты скоростей. Цифры — открытые оценки (ГУР/СМИ), официальных ТТХ нет.
// rangeKm — заявленная дальность, используется только для предупреждения.
// Названия и описания — в src/i18n.js (ключи `<id>.title`, `<id>.note`).
export const VEHICLES = {
  banderol: { icon: 'mdi-rocket-launch-outline', maxSpeedKmh: 650, rangeKm: 500 },
  geran2: { icon: 'mdi-quadcopter', maxSpeedKmh: 185, rangeKm: 2000 },
  geran3: { icon: 'mdi-airplane', maxSpeedKmh: 600, rangeKm: 2000 },
  geran5: { icon: 'mdi-airplane-takeoff', maxSpeedKmh: 600, rangeKm: 950 },
  custom: { icon: 'mdi-speedometer', maxSpeedKmh: 300, rangeKm: null },
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
