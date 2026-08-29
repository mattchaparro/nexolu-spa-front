import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

export interface GridAppointment {
  id: number
  item_id: number
  client_name: string | null
  service_name: string | null
  service_id: number
  status: string
  is_paid: boolean
  /** Hora visible para la clienta, HH:MM. */
  start: string
  end: string
  starts_at: string
  /** Incluye buffers: lo que el puesto queda realmente ocupado. */
  occupied_start: string
  occupied_end: string
}

export interface GridWindow {
  start: string
  end: string
}

/** Un almuerzo o descanso: hueco dentro de la jornada, con nombre. */
export interface GridBreak {
  start: string
  end: string
  label: string
}

export interface GridResource {
  id: number
  name: string
  color: string | null
  windows: GridWindow[]
  breaks: GridBreak[]
  appointments: GridAppointment[]
}

export interface GridDay {
  date: string
  weekday: number
  resources: GridResource[]
}

export interface AgendaResponse {
  timezone: string
  day_start: string
  day_end: string
  days: GridDay[]
}

export function useAgenda(from: Ref<string>, to: Ref<string | null>) {
  return useQuery({
    queryKey: ['agenda', from, to],
    queryFn: async () =>
      (
        await httpClient.get<AgendaResponse>('/agenda', {
          params: { from: from.value, ...(to.value ? { to: to.value } : {}) },
        })
      ).data,
  })
}

export function useReschedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      starts_at,
      resource_id,
    }: {
      id: number
      starts_at: string
      resource_id?: number
    }) => (await httpClient.patch(`/appointments/${id}/reschedule`, { starts_at, resource_id })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    },
  })
}

/** "09:30" -> 570. El eje de la rejilla se mide en minutos desde medianoche. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
