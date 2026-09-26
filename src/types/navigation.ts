/**
 * Que contador pintar al lado, si hay alguno pendiente.
 *
 * Es una LLAVE y no un numero: el menu se define una vez y los contadores
 * cambian solos. Que la definicion del menu tuviera que traer datos lo ataria
 * a una consulta y lo volveria imposible de probar.
 */
export type NavBadgeKey = 'inbox_unread' | 'outbox_pending'

/** Una pestaña de un grupo del menú (WhatsApp → Conversaciones, Difusiones...). */
export interface NavTab {
  label: string
  routeName: string
  badgeKey?: NavBadgeKey
}

export interface NavItem {
  label: string
  icon: string
  /** A dónde lleva la entrada: la primera pestaña que esta persona puede ver. */
  routeName: string
  /** Todas las pantallas del grupo: con cualquiera abierta, la entrada se marca activa. */
  routeNames: string[]
  /** Los contadores de sus pestañas: la entrada muestra la suma. */
  badgeKeys: NavBadgeKey[]
  /** Las pestañas del grupo, ya filtradas por permisos. Nada si es una pantalla suelta. */
  tabs?: NavTab[]
  /** true = el modulo todavia no existe en el front (lo usa NxSidebar). */
  disabled?: boolean
}
