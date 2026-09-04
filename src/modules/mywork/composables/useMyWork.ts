import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

export interface Earned {
  services: number
  charged: number
  commission: number
}

export interface AgendaRow {
  id: number
  time: string
  client_name: string | null
  client_id: number | null
  service_name: string | null
  status: string
  is_paid: boolean
  total: number | null
}

/**
 * Un servicio atendido que todavía no quedó registrado.
 *
 * Es la mitad EN PANTALLA del aviso de fin de servicio: la otra sale por
 * WhatsApp. Las dos dicen lo mismo a propósito — el WhatsApp la alcanza donde
 * de verdad mira, y esto es lo que ve al abrir el sistema para resolverlo. Un
 * aviso sin un lugar donde resolverlo es el recordatorio de una tarea
 * invisible.
 */
export interface PendingService {
  id: number
  client_name: string | null
  service_name: string | null
  label: string
  item_id: number | null
  /** Cuándo quedó listo el trabajo. */
  ended_at: string | null
  /**
   * El trabajo ya terminó. Distinto de "está pendiente": mientras la clienta
   * sigue en la silla no hay nada atrasado, y pintarlo igual sería mentir.
   */
  is_done: boolean
  /**
   * Qué falta. Lo resuelve el SERVIDOR cruzando la política del negocio, la
   * bandera del servicio y si ya hay foto — tres datos que esta pantalla no
   * tiene, y reimplementarlos acá es como una copia se desincroniza.
   */
  needs_photo: boolean
  has_photo: boolean
}

export interface MyWork {
  resource: { id: number; name: string } | null
  message?: string
  today: Earned
  week: Earned
  month: Earned
  pending_checkout: PendingService[]
  agenda: AgendaRow[]
}

export interface WalkInPayload {
  service_id: number
  resource_id?: number | null
  client_id?: number | null
  client_name?: string
  client_phone?: string
  payment_method_id?: number | null
  final_price?: number
  notes?: string
}

export function useMyWork() {
  return useQuery({
    queryKey: ['my-work'],
    queryFn: async () => (await httpClient.get<MyWork>('/my-work')).data,
    staleTime: 15_000,
  })
}

/**
 * La foto del trabajo recién hecho.
 *
 * NO va por `/clients/{id}/photos`: esa ruta pide `clientes.gestionar` y el
 * rol de profesional no lo tiene. Fotografiar lo que uno acaba de hacer no es
 * administrar la ficha de nadie, y la alternativa —darle acceso a toda la
 * clientela para esto— es pagar demasiado por una función pequeña.
 */
export function useWorkPhoto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      appointmentId,
      file,
      marketingConsent,
    }: {
      appointmentId: number
      file: File
      /** «¿Te puedo publicar esta foto?». Ausente = no. */
      marketingConsent?: boolean
    }) => {
      const form = new FormData()
      form.append('photo', file)
      if (marketingConsent) form.append('marketing_consent', '1')

      return (await httpClient.post(`/appointments/${appointmentId}/work-photo`, form)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-work'] })
      // La ficha muestra las fotos, y las publicaciones el listado de las
      // que se pueden publicar: las dos acaban de cambiar.
      queryClient.invalidateQueries({ queryKey: ['clients', 'profile'] })
      queryClient.invalidateQueries({ queryKey: ['social-posts'] })
    },
  })
}

/**
 * El comprobante de la transferencia.
 *
 * Es la imagen que hoy viaja por el grupo de WhatsApp junto a «uñas
 * semipermanente de cuarenta mil» — texto cuyo contenido ya está en el
 * sistema. Con el comprobante acá, ese mensaje deja de hacer falta.
 */
export function usePaymentProof() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ appointmentId, file }: { appointmentId: number; file: File }) => {
      const form = new FormData()
      form.append('proof', file)

      return (await httpClient.post(`/appointments/${appointmentId}/payment-proof`, form)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-work'] })
      // El cierre del día cuadra contra esto: si no se refresca, el
      // comprobante recién subido no aparece donde importa.
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] })
    },
  })
}

export function useWalkIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: WalkInPayload) => (await httpClient.post('/walk-in', payload)).data,
    // Un servicio sin cita es una cita normal por dentro: toca la agenda, la
    // disponibilidad, la caja y la ficha del cliente.
    onSuccess: () => {
      for (const key of [
        ['my-work'],
        ['agenda'],
        ['availability'],
        ['appointments'],
        ['cash'],
        ['daily-summary'],
        ['clients'],
      ]) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}
