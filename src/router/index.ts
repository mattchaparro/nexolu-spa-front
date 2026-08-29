import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth.store'

/**
 * Rutas de la SPA.
 *
 * Los modulos se van agregando por fase (ver el blueprint). Lo que ya esta
 * fijo es la forma: agenda como pantalla principal --es donde el negocio vive
 * todo el dia--, y la reserva publica fuera del layout autenticado.
 */
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/iniciar-sesion',
      name: 'login',
      component: () => import('@/modules/auth/views/LoginView.vue'),
      meta: { public: true, layout: 'auth' },
    },

    // Reserva publica: sin sesion, por slug del negocio. Alcance minimo a
    // proposito -- consultar y reservar, nada mas.
    {
      path: '/reservar/:businessSlug',
      name: 'public-booking',
      component: () => import('@/modules/publicBooking/views/PublicBookingView.vue'),
      meta: { public: true, layout: 'blank' },
    },

    {
      path: '/',
      redirect: { name: 'agenda' },
    },
    {
      path: '/agenda',
      name: 'agenda',
      component: () => import('@/modules/agenda/views/AgendaView.vue'),
      meta: { permission: 'citas.ver', feature: 'scheduling' },
    },
    {
      path: '/clientes',
      name: 'clients',
      component: () => import('@/modules/clients/views/ClientListView.vue'),
      meta: { permission: 'clientes.ver', feature: 'clients' },
    },
    {
      path: '/servicios',
      name: 'services',
      component: () => import('@/modules/catalog/views/ServiceListView.vue'),
      meta: { permission: 'servicios.gestionar' },
    },
    {
      path: '/equipo',
      name: 'resources',
      component: () => import('@/modules/catalog/views/ResourceListView.vue'),
      meta: { permission: 'recursos.gestionar' },
    },

    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/modules/shared/views/NotFoundView.vue'),
      meta: { public: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.public) {
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login' }
  }

  // En una carga directa (F5, o pegar una URL) solo se restaura el token desde
  // localStorage: el usuario, con sus permisos, no esta en memoria todavia.
  //
  // Sin esperar a traerlo, can() devuelve falso para TODO y el guard rebota
  // cada ruta contra la de inicio, que tambien exige permiso -- redireccion
  // infinita y pantalla en blanco. Vue Router la detecta y aborta, asi que el
  // sintoma es una pagina vacia sin ningun error visible.
  if (!auth.user) {
    try {
      await auth.fetchCurrentUser()
    } catch {
      // Token vencido o revocado: a login, no a una pantalla rota.
      auth.clearSession()
      return { name: 'login' }
    }
  }

  // El guard del router, el menu y el backend leen la MISMA fuente. Duplicar
  // la logica de permisos y features en el menu es como se termina mostrando
  // una opcion que despues rebota con un 403.
  if (to.meta.permission && !auth.can(to.meta.permission as string)) {
    return { name: 'agenda' }
  }

  if (to.meta.feature && !auth.hasFeature(to.meta.feature as string)) {
    return { name: 'agenda' }
  }

  return true
})

export default router
