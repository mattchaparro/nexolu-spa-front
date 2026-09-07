export interface NavItem {
  label: string
  icon: string
  routeName?: string
  /** true = el modulo todavia no existe en el front. */
  disabled?: boolean
  /**
   * Feature flag del negocio del que depende el item. Si el negocio no lo
   * tiene habilitado, useNavItems() lo saca del menu por completo en vez de
   * grisarlo: un item deshabilitado sugiere "disponible pronto", que es
   * enganoso para algo que el negocio ni siquiera contrato.
   */
  featureKey?: string
  /**
   * Que contador pintar al lado, si hay alguno pendiente.
   *
   * Es una LLAVE y no un numero: el menu se define una vez y los contadores
   * cambian solos. Que la definicion del menu tuviera que traer datos lo
   * ataria a una consulta y lo volveria imposible de probar.
   */
  badgeKey?: 'inbox_unread' | 'outbox_pending'
}
