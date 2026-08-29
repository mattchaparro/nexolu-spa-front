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
      path: '/clientes/:id',
      name: 'client',
      component: () => import('@/modules/clients/views/ClientDetailView.vue'),
      // Ver la ficha completa exige mas que poder elegir a alguien en un
      // buscador: aca esta su historial, cuanto gasta y sus fotos.
      meta: { permission: 'clientes.historial', feature: 'clients' },
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

    /*
     * Plataforma. Layout propio y oscuro a propósito: confundir este panel
     * con el de un negocio es como alguien termina cambiándole la
     * configuración al spa equivocado.
     */
    {
      path: '/superadmin',
      redirect: { name: 'sa-dashboard' },
    },
    {
      path: '/superadmin/resumen',
      name: 'sa-dashboard',
      component: () => import('@/modules/superadmin/views/PlatformDashboardView.vue'),
      meta: { layout: 'superadmin', superadmin: true },
    },
    {
      path: '/superadmin/negocios',
      name: 'sa-businesses',
      component: () => import('@/modules/superadmin/views/BusinessListView.vue'),
      meta: { layout: 'superadmin', superadmin: true },
    },
    {
      path: '/superadmin/negocios/:id',
      name: 'sa-business',
      component: () => import('@/modules/superadmin/views/BusinessDetailView.vue'),
      meta: { layout: 'superadmin', superadmin: true },
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

  // La plataforma es una propiedad del usuario, no un permiso del negocio:
  // ser admin de SU spa no da acceso a los demas.
  if (to.meta.superadmin) {
    return auth.isSuperAdmin ? true : { name: 'agenda' }
  }

  // Un usuario de plataforma no tiene negocio, asi que ninguna pantalla de
  // negocio le sirve: se le manda a lo suyo en vez de dejarlo rebotar contra
  // permisos que nunca va a tener.
  if (auth.isSuperAdmin) {
    return { name: 'sa-dashboard' }
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
