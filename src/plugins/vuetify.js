import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { ru } from 'vuetify/locale'

export default createVuetify({
  locale: { locale: 'ru', messages: { ru } },
  theme: {
    defaultTheme: 'system',
    themes: {
      light: { colors: { primary: '#1f5fbf', secondary: '#e8772e' } },
      dark: { colors: { primary: '#7aa7ff', secondary: '#ffa36b' } },
    },
  },
})
