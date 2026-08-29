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
  starts_at: string
  ends_at: string
  label: string
  items: AppointmentItem[]
}

export interface BookPayload {
  service_id: number
  resource_id: number
  starts_at: string
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

  return (await httpClient.get<ClientOption[]>('/clients', { params: { q: term } })).data
}

export interface CheckoutPayload {
  id: number
  payment_method_id: number
  discount_amount?: number
  discount_reason?: string
}

export function useCheckout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...body }: CheckoutPayload) =>
      (await httpClient.post<Appointment>(`/appointments/${id}/checkout`, body)).data,
    // Cobrar no libera el horario, asi que la disponibilidad no cambia: solo
    // hace falta refrescar la agenda.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}
