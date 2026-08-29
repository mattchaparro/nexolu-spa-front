import type { Ref } from 'vue'
import { useMutation, useQuery } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| La página pública de un negocio
|------------------------------------------------------------------------------
| Sin sesión. Estas peticiones salen sin token y el backend las trata como lo
| que son: lectura del catálogo y creación de UNA cita para quien la pide.
*/

export interface PublicService {
  id: number
  name: string
  description: string | null
  duration_min: number
  price: number
  image_url: string | null
  resource_ids: number[]
}

export interface PublicResource {
  id: number
  name: string
  color: string | null
  photo_url: string | null
}

/**
 * Un combo: varios servicios que se venden juntos con descuento.
 *
 * El backend sólo publica los que se pueden reservar en línea Y cuyas partes
 * también, así que lo que llega acá es ofrecible tal cual.
 */
export interface PublicPackage {
  id: number
  name: string
  description: string | null
  image_url: string | null
  total_minutes: number
  list_total: number
  discount: number
  total: number
  savings_percent: number
  services: Array<{ id: number; name: string; duration_min: number; price: number }>
}

export interface PublicHours {
  weekday: number
  label: string
  opens: string | null
  closes: string | null
  breaks: Array<{ start: string; end: string; label: string }>
}

export interface PublicPage {
  business: {
    name: string
    slug: string
    timezone: string
    currency: string
    address: string | null
    phone: string | null
    logo_url: string | null
    cover_url: string | null
  }
  profile: {
    headline: string | null
    about: string | null
    instagram: string | null
    whatsapp: string | null
    maps_url: string | null
  }
  services: PublicService[]
  packages: PublicPackage[]
  resources: PublicResource[]
  hours: PublicHours[]
}

export interface PublicChainLeg {
  service_id: number
  service_name: string
  resource_id: number
  resource_name: string
  starts_at: string
  label: string
  /** `skill` = no presta ese servicio; `busy` = no está libre a esa hora. */
  changed_reason: 'skill' | 'busy' | null
}

export interface PublicChainSlot {
  starts_at: string
  label: string
  same_person: boolean
  preferred_honored: boolean | null
  legs: PublicChainLeg[]
}

export interface PublicSlot {
  resource_id: number
  resource_name: string
  starts_at: string
  label: string
}

export interface BookingResult {
  reference: number
  service: string
  resource: string
  /** El nombre del combo, si vino de uno. */
  package: string | null
  /** La visita completa: qué, con quién y a qué hora cada parte. */
  items: Array<{ service: string; resource: string; time_label: string }>
  date_label: string
  time_label: string
  message: string
}

export function usePublicPage(slug: Ref<string>) {
  return useQuery({
    queryKey: ['public', slug],
    // Es una página de marketing: no cambia entre un clic y el siguiente.
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => (await httpClient.get<PublicPage>(`/public/${slug.value}`)).data,
  })
}

export function usePublicDays(
  slug: Ref<string>,
  serviceId: Ref<number | null>,
  from: Ref<string>,
  resourceId: Ref<number | null>,
) {
  return useQuery({
    queryKey: ['public', slug, 'days', serviceId, from, resourceId],
    enabled: () => serviceId.value !== null,
    queryFn: async () =>
      (
        await httpClient.get<{ days: Array<{ date: string; has_slots: boolean }> }>(
          `/public/${slug.value}/days`,
          {
            params: {
              service_id: serviceId.value,
              from: from.value,
              ...(resourceId.value ? { resource_id: resourceId.value } : {}),
            },
          },
        )
      ).data,
  })
}

export function usePublicSlots(
  slug: Ref<string>,
  serviceId: Ref<number | null>,
  date: Ref<string | null>,
  resourceId: Ref<number | null>,
) {
  return useQuery({
    queryKey: ['public', slug, 'slots', serviceId, date, resourceId],
    enabled: () => serviceId.value !== null && date.value !== null,
    queryFn: async () =>
      (
        await httpClient.get<{ slots: PublicSlot[] }>(`/public/${slug.value}/availability`, {
          params: {
            service_id: serviceId.value,
            date: date.value,
            ...(resourceId.value ? { resource_id: resourceId.value } : {}),
          },
        })
      ).data,
  })
}

/**
 * Dónde cabe un combo completo, no cada servicio por su lado.
 *
 * Encadenar `usePublicSlots` a mano daría horas libres para el primero y
 * ocupadas para el segundo, y en la página pública no hay nadie del local
 * mirando para corregir esa cita imposible.
 */
export function usePublicChain(
  slug: Ref<string>,
  packageId: Ref<number | null>,
  date: Ref<string | null>,
  resourceId: Ref<number | null>,
) {
  return useQuery({
    queryKey: ['public', slug, 'chain', packageId, date, resourceId],
    enabled: () => packageId.value !== null && date.value !== null,
    queryFn: async () =>
      (
        await httpClient.get<{ slots: PublicChainSlot[] }>(
          `/public/${slug.value}/availability/chain`,
          {
            params: {
              package_id: packageId.value,
              date: date.value,
              ...(resourceId.value ? { resource_id: resourceId.value } : {}),
            },
          },
        )
      ).data,
  })
}

export function useCreatePublicBooking(slug: Ref<string>) {
  return useMutation({
    mutationFn: async (payload: {
      /** Un servicio suelto... */
      service_id?: number
      resource_id?: number
      starts_at?: string
      /** ...o la cadena completa que devolvió el servidor. */
      items?: Array<{ service_id: number; resource_id: number; starts_at: string }>
      service_package_id?: number | null
      client_name: string
      client_phone: string
      notes?: string | null
    }) => (await httpClient.post<BookingResult>(`/public/${slug.value}/appointments`, payload)).data,
  })
}
