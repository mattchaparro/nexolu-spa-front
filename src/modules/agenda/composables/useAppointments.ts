import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

export interface AppointmentItem {
  id: number
  service_id: number
  service_name: string | null
  resource_id: number
  resource_name: string | null
  starts_at: string
  ends_at: string
  price: number
  final_price: number | null
  commission_rate: number | null
  commission_amount: number | null
}

export interface Appointment {
  id: number
  status: string
  status_label: string
  source: string
  client_id: number | null
  client_name: string | null
  client_phone: string | null
  notes: string | null
  is_paid: boolean
  payment_method?: string | null
  subtotal: number | null
  discount_amount: number
  total: number | null
  commission_total: number | null
  /**
   * El abono con que el cliente separó.
   *
   * `total` sigue siendo la venta completa: el abono no es un descuento, es
   * plata de la misma venta que entró antes. `amount_due` es lo que falta
   * cobrar cuando la persona se sienta.
   */
  deposit_amount: number
  deposit_paid_at: string | null
  deposit_paid: number
  amount_due: number
  starts_at: string
  ends_at: string
  label: string
  items: AppointmentItem[]
}

/**
 * Un servicio suelto, o una visita de varios.
 *
 * `items` lleva la hora de CADA tramo y no una sola de arranque: la cadena la
 * calculó el motor de disponibilidad, con los buffers y los cambios de persona
 * ya resueltos.
 */
export interface BookPayload {
  service_id?: number
  resource_id?: number
  starts_at?: string
  items?: Array<{ service_id: number; resource_id: number; starts_at: string }>
  /** De qué combo sale, para que el cobro aplique su descuento. */
  service_package_id?: number | null
  client_id?: number | null
  client_name?: string
  client_phone?: string
  notes?: string
}

export function useAppointments(date: Ref<string>) {
  return useQuery({
    queryKey: ['appointments', date],
    queryFn: async () =>
      (await httpClient.get<Appointment[]>('/appointments', { params: { date: date.value } })).data,
  })
}

/**
 * Al agendar se invalidan agenda Y disponibilidad: son dos vistas del mismo
 * hecho, y dejar una sin refrescar muestra un hueco que ya no existe.
 */
export function useBookAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: BookPayload) =>
      (await httpClient.post<Appointment>('/appointments', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

export function useCancelAppointment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) =>
      (await httpClient.post<Appointment>(`/appointments/${id}/cancel`, { reason })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

export interface ClientOption {
  id: number
  full_name: string
  phone: string | null
  label: string
}

export async function searchClients(term: string): Promise<ClientOption[]> {
  if (term.trim().length < 2) {
    return []
  }

  return (await httpClient.get<ClientOption[]>('/clients/search', { params: { q: term } })).data
}

export interface CheckoutPayload {
  id: number
  payment_method_id: number
  discount_amount?: number
  discount_reason?: string
  /** Premio de la tarjeta de sellos que se usa hoy. */
  loyalty_reward_id?: number | null
}

export function useCheckout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...body }: CheckoutPayload) =>
      (await httpClient.post<Appointment>(`/appointments/${id}/checkout`, body)).data,
    // Cobrar no libera el horario, asi que la disponibilidad no cambia: solo
    // hacen falta las dos vistas de la agenda, que muestran el estado y el
    // total cobrado.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

/**
 * Registrar que el abono llegó.
 *
 * No se cobra en línea: el cliente transfiere y alguien del local confirma.
 * Por eso pide método de pago -- sin él la plata entra sin quedar en ninguna
 * cuenta y el cierre del día no cuadra.
 */
export function useRegisterDeposit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: number
      payment_method_id: number
      amount?: number
      reference?: string
    }) => (await httpClient.post<Appointment>(`/appointments/${id}/deposit`, body)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      // El abono entra a la caja el día que llega, no el del servicio.
      queryClient.invalidateQueries({ queryKey: ['cash'] })
    },
  })
}

/*
|------------------------------------------------------------------------------
| Etapas
|------------------------------------------------------------------------------
| El estado de una cita con el vocabulario del negocio. "Confirmada" y
| "En la silla" son lo que se dice en el mostrador; `confirmed` e `in_progress`
| son lo que el sistema calcula por debajo.
*/

export interface StageOption {
  stage_id: number | null
  key: string
  label: string
  color: string | null
  maps_to_status: string
}

export interface StageActionOutcome {
  label: string
  status: 'ok' | 'failed' | 'skipped'
  detail: string | null
}

export interface StageOptions {
  current: { status: string; status_label: string; stage_id: number | null }
  options: StageOption[]
}

export interface HistoryEntry {
  id: number
  at: string
  from: string | null
  to: string
  by: string | null
  actor: string
  actions: StageActionOutcome[]
}

export function useStageOptions(appointmentId: Ref<number | null>) {
  return useQuery({
    queryKey: ['appointment-stages', appointmentId],
    enabled: () => appointmentId.value !== null,
    queryFn: async () =>
      (await httpClient.get<StageOptions>(`/appointments/${appointmentId.value}/stages`)).data,
  })
}

export function useAppointmentHistory(appointmentId: Ref<number | null>) {
  return useQuery({
    queryKey: ['appointment-history', appointmentId],
    enabled: () => appointmentId.value !== null,
    queryFn: async () =>
      (await httpClient.get<HistoryEntry[]>(`/appointments/${appointmentId.value}/history`)).data,
  })
}

export function useMoveStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, stageId, status }: { id: number; stageId?: number | null; status?: string }) =>
      (
        await httpClient.post<{ actions: StageActionOutcome[] }>(`/appointments/${id}/stage`, {
          stage_id: stageId ?? null,
          status: status ?? null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['appointment-stages'] })
      queryClient.invalidateQueries({ queryKey: ['appointment-history'] })
      // Cobrar puede ser una acción de etapa: la caja del día cambia con ella.
      queryClient.invalidateQueries({ queryKey: ['cash'] })
    },
  })
}
