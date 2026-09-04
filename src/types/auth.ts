// Refleja UserResource de nexolu-spa-api. Mantener sincronizado si el resource
// cambia: es el unico contrato entre los dos repos.

export interface Business {
  id: number
  name: string
  slug: string
  vertical: 'spa_unas' | 'barberia' | 'estetica'
  timezone: string
  currency: string
  /**
   * Banderas YA resueltas por el backend (Business::resolvedFeatureFlags()).
   *
   * El front lee este mapa y nunca reimplementa la resolucion. Tener dos
   * implementaciones de la misma logica es como el POS termino mostrandole a
   * un negocio del plan Basico modulos que no habia contratado.
   */
  resolved_features: Record<string, boolean>
  subscription_plan: 'basico' | 'pro' | 'full' | null
  /**
   * Topes del plan CON el uso de hoy (Business::planUsage()).
   *
   * `limit: null` = sin tope. Sirve para decir "2 de 3" ANTES de que alguien
   * llene un formulario que va a ser rechazado al guardar.
   */
  plan_usage: Record<string, { limit: number | null; used: number; remaining: number | null }>
  scheduling_settings: {
    slot_granularity_min: number
    min_booking_notice_min: number
    min_cancellation_notice_min: number
    max_booking_horizon_days: number

    /**
     * Si al cerrar un servicio se le pide a quien atendió la foto del trabajo.
     *
     * Viene YA RESUELTA (política del negocio + bandera `client_history`): la
     * pantalla necesita saber si preguntar, no interpretar una política.
     */
    asks_service_photo: boolean

    /**
     * Cuándo se pide el comprobante de pago.
     *
     * Sigue siendo política y no un booleano porque depende del medio de pago,
     * que todavía no se ha elegido cuando esto se lee. La vista la cruza con
     * `counts_as_cash` del método.
     */
    payment_proof_policy: 'none' | 'non_cash' | 'always'
  } | null
}

export interface User {
  id: number
  name: string
  last_name: string | null
  full_name: string
  email: string
  phone: string | null
  is_active: boolean
  business_id: number | null
  business: Business | null
  is_super_admin: boolean
  /** El recurso agendable que representa a este usuario, si presta servicios. */
  resource_id: number | null

  /** El dueño del negocio: ve todas las sedes, siempre. */
  is_owner: boolean

  /**
   * Las sedes que ve, ya resueltas por el servidor. `null` = todas.
   *
   * El front las usa para armar sus selectores; el servidor las vuelve a
   * resolver en cada petición, porque una lista que viajó al navegador es una
   * sugerencia, no una defensa.
   */
  location_ids: number[] | null

  roles: string[]
  permissions: string[]
}

export interface LoginCredentials {
  email: string
  password: string
  device_name: string
}

export interface AuthResponse {
  token: string
  user: User
}
