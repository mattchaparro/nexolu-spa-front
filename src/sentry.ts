// Sentry (opcional): VITE_SENTRY_DSN_PUBLIC vacio deja esto como no-op -
// nunca se llama Sentry.init() y las funciones de tagging de abajo son
// inertes sin un client inicializado. Dejar vacio fuera de produccion es
// la UNICA defensa posible del lado del frontend: a diferencia del backend
// (config/sentry.php resuelve el ambiente en tiempo de ejecucion), el DSN
// del frontend queda congelado en el bundle compilado - no hay forma de
// "apagarlo" despues del build.
//
// Portado de pos-saas-legacy (resources/js/app.js): mismo tageo de
// business_id/business_name/user por request para poder filtrar
// errores/traces por negocio, mismo tracesSampleRate que el backend
// (SENTRY_TRACES_SAMPLE_RATE) para poder cruzar trazas de front y back de
// la misma request. La diferencia es COMO se sincroniza: el legacy lo hacia
// en cada navegacion de Inertia (router.on('navigate', ...) con las props
// de esa pagina); esta SPA no tiene "props de pagina" - se lee el usuario
// del store de auth y el negocio de la cache de TanStack Query
// (['business'], ya poblada por useBusiness()) en cada cambio de ruta.
import * as Sentry from '@sentry/vue'
import type { App } from 'vue'
import type { Router } from 'vue-router'

import { queryClient } from './services/query/queryClient'
import { useAuthStore } from './stores/auth.store'
import type { Business } from './types/auth'

export function initSentry(app: App, router: Router): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN_PUBLIC
  if (!dsn) {
    return
  }

  Sentry.init({
    app,
    dsn,
    // browserTracingIntegration con el router: Sentry arma sus propios
    // spans de navegacion solo (no hace falta instrumentar afterEach a
    // mano para eso) - el afterEach de abajo es solo para el tageo de
    // negocio/usuario, no para performance.
    integrations: [Sentry.browserTracingIntegration({ router })],
    tracesSampleRate:
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE !== undefined
        ? Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE)
        : 1.0,
  })

  router.afterEach(syncSentryBusinessContext)
  syncSentryBusinessContext()
}

function syncSentryBusinessContext(): void {
  const auth = useAuthStore()
  if (!auth.user) {
    return
  }

  Sentry.setTag('business_id', String(auth.user.business_id ?? 'none'))
  Sentry.setTag('business_name', queryClient.getQueryData<Business>(['business'])?.name ?? 'none')
  Sentry.setUser({ id: String(auth.user.id) })
}
