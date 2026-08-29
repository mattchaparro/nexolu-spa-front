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
  /** Quien presta el servicio. Sin esto no se puede filtrar por persona. */
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

/*
|------------------------------------------------------------------------------
| Cadenas y combos
|------------------------------------------------------------------------------
| Una visita de varios servicios, uno detrás de otro. Encadenar la respuesta de
| `useAvailability` a mano no sirve: da huecos que están libres para el primero
| y no para el tercero.
*/

export interface ChainLeg {
  service_id: number
  service_name: string
  resource_id: number
  resource_name: string
  starts_at: string
  label: string
  /**
   * Por qué este tramo NO quedó con la persona esperada.
   *
   * `skill` = no presta ese servicio. `busy` = sí lo presta, pero a esa hora
   * está ocupada. Son dos respuestas distintas del cliente: la primera se
   * acepta, la segunda invita a mirar otra hora.
   */
  changed_reason: 'skill' | 'busy' | null
}

export interface ChainSlot {
  starts_at: string
  ends_at: string
  label: string
  /** Toda la visita con la misma persona. */
  same_person: boolean
  /**
   * Se pidió una persona y se le pudieron dar todos los servicios.
   * `null` cuando no se pidió a nadie: ahí lo que importa es `same_person`.
   */
  preferred_honored: boolean | null
  legs: ChainLeg[]
}

export interface ServicePackage {
  id: number
  name: string
  description: string | null
  image_url: string | null
  discount_type: string
  discount_value: number | null
  is_active: boolean
  total_minutes: number
  list_total: number
  discount: number
  total: number
  savings_percent: number
  services: Array<{ id: number; name: string; price: number; duration_min: number }>
}

export interface ChainResponse {
  date: string
  services: Array<{ id: number; name: string; duration_min: number; price: number }>
  total_minutes: number
  package: ({ id: number; name: string } & {
    list_total: number
    discount: number
    total: number
    savings_percent: number
  }) | null
  preferred_resource: { id: number; name: string } | null
  slots: ChainSlot[]
}

/**
 * `preferredId` es preferencia, no filtro.
 *
 * Pedir "todo con Aleja" y que desaparezcan las horas en que Aleja no presta
 * uno de los servicios sería peor que ofrecerlas diciendo quién toma ese
 * tramo. El backend devuelve la hora igual, con `changed_reason`.
 */
export function useChainAvailability(
  serviceIds: Ref<number[]>,
  packageId: Ref<number | null>,
  date: Ref<string>,
  preferredId?: Ref<number | null>,
) {
  return useQuery({
    queryKey: ['availability', 'chain', serviceIds, packageId, date, preferredId ?? null],
    enabled: computed(() =>
      Boolean(date.value) && (packageId.value !== null || serviceIds.value.length > 0),
    ),
    queryFn: async () => {
      const { data } = await httpClient.get<ChainResponse>('/availability/chain', {
        params: {
          ...(packageId.value
            ? { package_id: packageId.value }
            : { 'service_ids[]': serviceIds.value }),
          date: date.value,
          ...(preferredId?.value ? { resource_id: preferredId.value } : {}),
        },
      })
      return data
    },
  })
}

export function usePackages() {
  return useQuery({
    queryKey: ['service-packages'],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await httpClient.get<{ packages: ServicePackage[] }>('/service-packages')).data,
  })
}
