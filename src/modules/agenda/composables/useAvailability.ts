import { computed, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

export interface Slot {
  resource_id: number
  resource_name: string
  starts_at: string
  ends_at: string
  /** Hora local del negocio, ya formateada por el backend. */
  label: string
}

export interface AvailabilityResponse {
  date: string
  timezone: string
  service: { id: number; name: string; duration_min: number }
  slots: Slot[]
}

export interface Service {
  id: number
  name: string
  duration_min: number
  buffer_before_min: number
  buffer_after_min: number
  occupied_min: number
  price: number
  /** Quien presta el servicio. Sin esto no se puede filtrar por profesional. */
  resource_ids?: number[]
}

export interface Resource {
  id: number
  type: string
  name: string
  color: string | null
}

export function useServices() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => (await httpClient.get<Service[]>('/services')).data,
    // El catalogo cambia poco comparado con la agenda.
    staleTime: 5 * 60_000,
  })
}

export function useResources() {
  return useQuery({
    queryKey: ['resources'],
    queryFn: async () => (await httpClient.get<Resource[]>('/resources')).data,
    staleTime: 5 * 60_000,
  })
}

/**
 * Disponibilidad de un servicio en una fecha.
 *
 * La query se desactiva sin servicio elegido en vez de mandar una peticion
 * incompleta que el backend rechazaria con un 422.
 */
export function useAvailability(serviceId: Ref<number | null>, date: Ref<string>) {
  return useQuery({
    queryKey: ['availability', serviceId, date],
    enabled: computed(() => Boolean(serviceId.value && date.value)),
    queryFn: async () => {
      const { data } = await httpClient.get<AvailabilityResponse>('/availability', {
        params: { service_id: serviceId.value, date: date.value },
      })
      return data
    },
  })
}
