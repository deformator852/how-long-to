// Медиазапросы в React: ширина экрана и системная тема (веб-часть; в React Native — useColorScheme из 'react-native').
import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** 'light' | 'dark' — по системной настройке, как и CSS-переменные в styles.css. */
export function useColorScheme() {
  return useMediaQuery('(prefers-color-scheme: dark)') ? 'dark' : 'light'
}
