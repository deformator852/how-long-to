import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { ru, uk } from 'vuetify/locale'

export default createVuetify({
  locale: { locale: 'uk', fallback: 'ru', messages: { uk, ru } },
  theme: {
    defaultTheme: 'system',
    themes: {
      light: { colors: { primary: '#1f5fbf', secondary: '#e8772e' } },
      dark: { colors: { primary: '#7aa7ff', secondary: '#ffa36b' } },
    },
  },
})
