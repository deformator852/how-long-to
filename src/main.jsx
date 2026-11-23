import '@mdi/font/css/materialdesignicons.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { configurePlaces } from '@how-long-to/core'
// Справочник пунктов лежит в общем пакете; в веб-сборку он попадает отдельным файлом и скачивается при первом поиске.
import placesUrl from '@how-long-to/core/data/places-ua.json?url'
import App from './App'

configurePlaces({
  load: () =>
    fetch(placesUrl).then((res) => {
      if (!res.ok) throw new Error(`places-ua.json: HTTP ${res.status}`)
      return res.json()
    }),
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
