import { stashSsoTokenFromUrl } from '@/services/http/tokenStorage'

stashSsoTokenFromUrl()

// Lato self-hosted via @fontsource, igual que el POS: continuidad de marca
// entre productos sin depender de un host de fuentes externo.
import '@fontsource/lato/400.css'
import '@fontsource/lato/700.css'
import 'primeicons/primeicons.css'
import './style.css'

import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { queryClient } from './services/query/queryClient'
import { initSentry } from './sentry'
import { useAuthStore } from './stores/auth.store'
import { nexoluPreset } from './theme/nexoluPreset'

const app = createApp(App)

app.use(createPinia())
app.use(router)
// Despues de Pinia y router (los necesita para taggear business_id/user en
// cada navegacion), antes de mount(). No-op si VITE_SENTRY_DSN_PUBLIC esta
// vacio.
initSentry(app, router)

// Aura + indigo de marca. darkModeSelector: false porque el resto de la app
// (Tailwind) no tiene modo oscuro; sin esto Aura sigue el prefers-color-scheme
// del sistema operativo y queda desparejo.
app.use(PrimeVue, {
  theme: { preset: nexoluPreset, options: { darkModeSelector: false } },
  license: import.meta.env.VITE_PRIMEVUE_LICENSE_KEY,
  // Los componentes con texto propio (DatePicker sobre todo, que en una app
  // de agenda esta en todas partes) salen en ingles sin esto.
  locale: {
    monthNames: [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ],
    monthNamesShort: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
    dayNames: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    today: 'Hoy',
    clear: 'Limpiar',
    weekHeader: 'Sem',
    firstDayOfWeek: 1,
    emptyMessage: 'Sin resultados',
    emptyFilterMessage: 'Sin resultados',
    chooseYear: 'Elegir año',
    chooseMonth: 'Elegir mes',
    chooseDate: 'Elegir fecha',
    prevDecade: 'Década anterior',
    nextDecade: 'Década siguiente',
    prevYear: 'Año anterior',
    nextYear: 'Año siguiente',
    prevMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    am: 'a. m.',
    pm: 'p. m.',
  },
})
app.use(VueQueryPlugin, { queryClient })
app.use(ToastService)

app.mount('#app')

// Revalida la sesion cuando la pestaña vuelve a estar visible. TanStack Query
// ya reintenta al recuperar el foco, pero eso depende de que haya una query
// montada y de que el navegador dispare el evento a tiempo, cosa poco
// confiable en movil. Sin este chequeo, una sesion vencida con la pestaña
// oculta deja la app mostrando datos viejos sin disparar nunca el 401.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    return
  }

  const auth = useAuthStore()

  if (auth.isAuthenticated) {
    // El 401 lo maneja el interceptor de axios. Cualquier otro error (la red
    // reconectando, por ejemplo) no debe desloguear a nadie.
    auth.fetchCurrentUser().catch(() => {})
  }
})
