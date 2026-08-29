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
  resources: PublicResource[]
  hours: PublicHours[]
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

export function useCreatePublicBooking(slug: Ref<string>) {
  return useMutation({
    mutationFn: async (payload: {
      service_id: number
      resource_id: number
      starts_at: string
      client_name: string
      client_phone: string
      notes?: string | null
    }) => (await httpClient.post<BookingResult>(`/public/${slug.value}/appointments`, payload)).data,
  })
}
