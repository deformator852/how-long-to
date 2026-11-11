// Пресеты скоростей. Цифры — открытые оценки (ГУР/СМИ), официальных ТТХ нет.
// rangeKm — заявленная дальность, используется только для предупреждения.
export const VEHICLES = {
  banderol: {
    title: 'Бандероль (S8000)',
    icon: 'mdi-rocket-launch-outline',
    maxSpeedKmh: 650,
    rangeKm: 500,
    note: 'Крылатая ракета, макс. ~650 км/ч, крейсерская ~500–560 км/ч',
  },
  geran2: {
    title: 'Герань-2',
    icon: 'mdi-quadcopter',
    maxSpeedKmh: 185,
    rangeKm: 2000,
    note: 'Ударный БПЛА, макс. ~185 км/ч',
  },
  geran3: {
    title: 'Герань-3 (реакт.)',
    icon: 'mdi-airplane',
    maxSpeedKmh: 600,
    rangeKm: 2000,
    note: 'Реактивный БПЛА, ~550–600 км/ч (оценка СМИ)',
  },
  geran5: {
    title: 'Герань-5',
    icon: 'mdi-airplane-takeoff',
    maxSpeedKmh: 600,
    rangeKm: 950,
    note: 'Реактивный ударный БПЛА, ~600 км/ч, дальность ~950 км (оценка ГУР/СМИ; для модификации К5-К заявляют до 1000 км/ч)',
  },
  custom: {
    title: 'Своя скорость',
    icon: 'mdi-speedometer',
    maxSpeedKmh: 300,
    rangeKm: null,
    note: 'Задайте скорость вручную',
  },
}

/** Время полёта по прямой, в минутах. */
export function flightMinutes(distanceKm, speedKmh) {
  return (distanceKm / speedKmh) * 60
}

/** 83.4 → «1 ч 23 мин», 4.2 → «4 мин 12 с». */
export function formatDuration(minutes) {
  const totalSec = Math.round(minutes * 60)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h} ч ${m} мин`
  if (m > 0) return s ? `${m} мин ${s} с` : `${m} мин`
  return `${s} с`
}
