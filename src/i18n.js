// Минимальная локализация без библиотек: украинский по умолчанию, русский — по переключателю.
import { ref, watch } from 'vue'

const STORAGE_KEY = 'distance-count:lang'
export const LANGS = ['uk', 'ru']

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (LANGS.includes(saved)) return saved
  } catch {
    /* хранилище недоступно */
  }
  return 'uk'
}

export const lang = ref(initialLang())

watch(lang, (v) => {
  document.documentElement.lang = v
  try {
    localStorage.setItem(STORAGE_KEY, v)
  } catch {
    /* не сохраняем */
  }
}, { immediate: true })

const MESSAGES = {
  uk: {
    appTitle: 'Час підльоту',
    from: 'Звідки',
    to: 'Куди',
    swap: 'Поміняти місцями',
    placeholder: 'Почніть вводити назву…',
    loadError: 'Не вдалося завантажити довідник населених пунктів. Оновіть сторінку.',
    multiHint: 'Можна вибрати кілька.',
    speed: 'Швидкість',
    kmh: 'км/год',
    emptyHint: 'Виберіть два населені пункти — час порахується одразу.',
    recent: 'Нещодавні маршрути',
    resultTitle: 'Час польоту на макс. швидкості',
    kmStraight: 'км по прямій',
    outOfRange: 'Більше заявленої дальності (~{km} км)',
    disclaimer: 'Час = відстань по прямій ÷ максимальна швидкість. Реальний маршрут із маневрами довший, тож це нижня межа. Швидкості — відкриті оцінки, не офіційні ТТХ. Населені пункти:',
    contact: 'Зв’язок з автором',
    kmFrom: '{km} км від м. {city}',
    residents: '{n} мешк.',
    h: 'год', min: 'хв', s: 'с',
    'banderol.title': 'Бандероль (S8000)',
    'banderol.note': 'Крилата ракета, макс. ~650 км/год, крейсерська ~500–560 км/год',
    'geran2.title': 'Герань-2 (Shahed-136)',
    'geran2.note': 'Ударний БпЛА, макс. ~185 км/год',
    'geran3.title': 'Герань-3 (реакт.)',
    'geran3.note': 'Реактивний БпЛА, ~550–600 км/год (оцінка ЗМІ)',
    'geran5.title': 'Герань-5',
    'geran5.note': 'Реактивний ударний БпЛА, ~600 км/год, дальність ~950 км (оцінка ГУР/ЗМІ; для модифікації К5-К заявляють до 1000 км/год)',
    'custom.title': 'Своя швидкість',
    'custom.note': 'Задайте швидкість вручну',
  },
  ru: {
    appTitle: 'Время подлёта',
    from: 'Откуда',
    to: 'Куда',
    swap: 'Поменять местами',
    placeholder: 'Начните вводить название…',
    loadError: 'Не удалось загрузить справочник населённых пунктов. Обновите страницу.',
    multiHint: 'Можно выбрать несколько.',
    speed: 'Скорость',
    kmh: 'км/ч',
    emptyHint: 'Выберите два населённых пункта — время посчитается сразу.',
    recent: 'Недавние маршруты',
    resultTitle: 'Время полёта при макс. скорости',
    kmStraight: 'км по прямой',
    outOfRange: 'Больше заявленной дальности (~{km} км)',
    disclaimer: 'Время = расстояние по прямой ÷ максимальная скорость. Реальный маршрут с манёврами длиннее, поэтому это нижняя граница. Скорости — открытые оценки, не официальные ТТХ. Населённые пункты:',
    contact: 'Связь с автором',
    kmFrom: '{km} км от г. {city}',
    residents: '{n} жит.',
    h: 'ч', min: 'мин', s: 'с',
    'banderol.title': 'Бандероль (S8000)',
    'banderol.note': 'Крылатая ракета, макс. ~650 км/ч, крейсерская ~500–560 км/ч',
    'geran2.title': 'Герань-2 (Shahed-136)',
    'geran2.note': 'Ударный БПЛА, макс. ~185 км/ч',
    'geran3.title': 'Герань-3 (реакт.)',
    'geran3.note': 'Реактивный БПЛА, ~550–600 км/ч (оценка СМИ)',
    'geran5.title': 'Герань-5',
    'geran5.note': 'Реактивный ударный БПЛА, ~600 км/ч, дальность ~950 км (оценка ГУР/СМИ; для модификации К5-К заявляют до 1000 км/ч)',
    'custom.title': 'Своя скорость',
    'custom.note': 'Задайте скорость вручную',
  },
}

/** t('outOfRange', { km: 500 }) → строка на текущем языке. Реактивна, т.к. читает lang.value. */
export function t(key, params = {}) {
  const s = MESSAGES[lang.value][key] ?? MESSAGES.uk[key] ?? key
  return s.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '')
}

export const numberLocale = () => (lang.value === 'uk' ? 'uk-UA' : 'ru-RU')
