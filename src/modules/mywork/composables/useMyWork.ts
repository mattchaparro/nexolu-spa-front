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
