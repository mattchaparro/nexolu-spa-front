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
}
