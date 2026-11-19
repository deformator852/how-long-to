import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { uk } from 'vuetify/locale'
import { legThemeColors } from '../utils/routeColors'

export default createVuetify({
  locale: { locale: 'uk', messages: { uk } },
  theme: {
    defaultTheme: 'system',
    themes: {
      light: { colors: { primary: '#1f5fbf', secondary: '#e8772e', ...legThemeColors('light') } },
      dark: { colors: { primary: '#7aa7ff', secondary: '#ffa36b', ...legThemeColors('dark') } },
    },
  },
})
