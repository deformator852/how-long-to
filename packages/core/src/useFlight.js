// React-хук калькулятора — один и тот же для веба и React Native. Экземпляров может быть сколько угодно:
// главный экран (с историей) и примеры на странице точности (каждый со своим состоянием).
import { useEffect, useMemo, useReducer } from 'react'
import { HISTORY_KEY, deriveRoute, initialRouteState, parseHistory, routeActions, routeReducer } from './route.js'

const isThenable = (v) => v != null && typeof v.then === 'function'

/** Прочитать историю; хранилище может быть синхронным (localStorage) или асинхронным (AsyncStorage). */
function readHistory(storage) {
  try {
    return storage.getItem(HISTORY_KEY)
  } catch {
    return null // приватный режим браузера и т. п.
  }
}

/**
 * @param {object} [options]
 * @param {object[]} [options.points]   начальный маршрут (пункты из справочника или точки с карты)
 * @param {string[]} [options.vehicles] начальные аппараты (ключи VEHICLES)
 * @param {{ getItem(key: string): string | null | Promise<string | null>, setItem(key: string, value: string): unknown }} [options.storage]
 *   где хранить «Нещодавні маршрути»: localStorage в вебе, AsyncStorage в React Native. Без storage история не ведётся.
 */
export function useFlight({ points, vehicles, storage } = {}) {
  const [state, dispatch] = useReducer(routeReducer, null, () => {
    const saved = storage ? readHistory(storage) : null
    // Синхронное хранилище — история сразу в начальном состоянии, без мигания пустого списка.
    const history = typeof saved === 'string' ? parseHistory(saved) : []
    return { ...initialRouteState({ points, vehicles, trackHistory: Boolean(storage), history }), historyReady: !isThenable(saved) }
  })

  // Асинхронное хранилище: подгружаем историю после монтирования.
  useEffect(() => {
    if (!storage || state.historyReady) return
    let cancelled = false
    Promise.resolve(readHistory(storage))
      .then((json) => !cancelled && dispatch(routeActions.historyLoaded(json ? parseHistory(json) : [])))
      .catch(() => !cancelled && dispatch(routeActions.historyLoaded([])))
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- хранилище задаётся один раз

  // Сохраняем историю, когда она меняется (но не раньше, чем загрузили сохранённую — иначе затрём её).
  useEffect(() => {
    if (!storage || !state.historyReady) return
    try {
      Promise.resolve(storage.setItem(HISTORY_KEY, JSON.stringify(state.history))).catch(() => {})
    } catch {
      /* приватный режим — не сохраняем */
    }
  }, [state.history, state.historyReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const derived = useMemo(() => deriveRoute(state), [state.stops, state.vehicles, state.customSpeedKmh]) // eslint-disable-line react-hooks/exhaustive-deps

  const actions = useMemo(
    () => ({
      /** Добавить пустой слот в конец; возвращает его key (например, чтобы поставить в него фокус). */
      addStop() {
        const action = routeActions.addStop()
        dispatch(action)
        return action.stop.key
      },
      removeStop: (key) => dispatch(routeActions.removeStop(key)),
      setPlace: (key, place) => dispatch(routeActions.setPlace(key, place)),
      /** Точка с карты: в первый пустой слот после заполненных, иначе в конец. */
      addPoint: (place) => dispatch(routeActions.addPoint(place)),
      removeLastPoint: () => dispatch(routeActions.removeLastPoint()),
      reverse: () => dispatch(routeActions.reverse()),
      clear: () => dispatch(routeActions.clear()),
      /** Маршрут из истории или пример: { points, vehicles }. */
      restore: (entry) => dispatch(routeActions.restore(entry)),
      setVehicles: (list) => dispatch(routeActions.setVehicles(list)),
      setCustomSpeedKmh: (value) => dispatch(routeActions.setCustomSpeed(value)),
    }),
    [],
  )

  return useMemo(
    () => ({
      stops: state.stops,
      vehicles: state.vehicles,
      customSpeedKmh: state.customSpeedKmh,
      history: state.history,
      ...derived,
      ...actions,
    }),
    [state.stops, state.vehicles, state.customSpeedKmh, state.history, derived, actions],
  )
}
