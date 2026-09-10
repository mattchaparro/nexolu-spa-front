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

export interface MyWork {
  resource: { id: number; name: string } | null
  message?: string
  today: Earned
  week: Earned
  month: Earned
  pending_checkout: Array<{
    id: number
    client_name: string | null
    service_name: string | null
    label: string
  }>
  agenda: AgendaRow[]
  ratings: MyRatings
}

/**
 * Las calificaciones de ELLA, en porcentaje sobre su propia escala.
 *
 * Porcentaje y no "4,9 de 5" porque las notas de Luxury no vienen todas sobre
 * cinco: la encuesta vieja preguntaba atención con cinco botones, servicio con
 * cuatro y puntualidad con tres. El servidor ya las normaliza; acá sólo se
 * pintan. Ver `App\Support\Ratings\Nota` en el backend.
 *
 * Todo puede venir `null`: quien todavía no tiene ninguna opinión no tiene un
 * cero, tiene nada. Son cosas distintas y se ven distinto.
 */
export interface MyRatings {
  count: number
  since: string
  attention: number | null
  service: number | null
  punctuality: number | null
  this_month: { count: number; attention: number | null }
  previous_month: { count: number; attention: number | null }
  comments: Array<{ comment: string; attention: number | null; date: string | null }>
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

export function useWalkIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: WalkInPayload) =>
      (await httpClient.post('/walk-in', payload)).data,
    // Un servicio sin cita es una cita normal por dentro: toca la agenda, la
    // disponibilidad, la caja y la ficha del cliente.
    onSuccess: () => {
      for (const key of [['my-work'], ['agenda'], ['availability'], ['appointments'], ['cash'], ['daily-summary'], ['clients']]) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}
