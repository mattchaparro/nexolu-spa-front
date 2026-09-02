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
  category_id: number | null
  category: string | null
  /** De los más reservados en los últimos 90 días. El servidor no dice cuántos. */
  is_popular: boolean
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

export interface PublicLocation {
  id: number
  slug: string
  name: string
  address: string | null
  city: string | null
  phone?: string | null
  maps_url: string | null
}

/**
 * Alguien del equipo, para la sección de colaboradores.
 *
 * Distinto de `PublicResource`: aquel dice CON QUIÉN SE PUEDE RESERVAR y lo usa
 * el selector del formulario. Este dice A QUIÉN VAS A ENCONTRAR, y son
 * conjuntos que no coinciden — una manicurista cuya agenda maneja el mostrador
 * no acepta reservas por internet y aun así merece estar en la vitrina.
 */
export interface PublicTeamMember {
  id: number
  name: string
  photo_url: string | null
  bio: string | null
  /** Null si el negocio no publica notas, o si todavía no hay suficientes. */
  rating: number | null
  ratings_count: number
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
    google_review_url: string | null
    /** Si la puntuación de cada persona sale en la página. */
    show_staff_ratings: boolean
  }
  /**
   * Las sedes del negocio, y cuál se está mirando.
   *
   * `locations` viene siempre, también con una sola: la pantalla decide con
   * `length > 1` si muestra el paso, y no tiene que adivinar por la ausencia
   * del campo. `location` es null cuando hay varias y todavía no se eligió.
   */
  locations: PublicLocation[]
  location: PublicLocation | null

  /**
   * Con qué prellenar el formulario, si el enlace traía `?c=<token>`.
   *
   * Null cuando no hay token o no es válido. El navegador NO conoce el
   * teléfono de quien lo abre: esto lo sabe el negocio porque ya estaba en la
   * ficha, y viaja porque el token dice de quién es esa ficha.
   */
  client: { name: string; phone: string | null; email: string | null } | null
  services: PublicService[]
  packages: PublicPackage[]
  resources: PublicResource[]
  team: PublicTeamMember[]
  hours: PublicHours[]
  /**
   * Cuánto hay que abonar para separar, o `null` si el negocio no pide.
   *
   * Viene en la carga inicial para poder decirlo ANTES de que la persona
   * llene el formulario. Enterarse del abono después de confirmar es la peor
   * forma de pedirlo.
   */
  deposit: {
    type: 'percent' | 'fixed'
    value: number
    instructions: string | null
    label: string | null
  } | null
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
  /** Lo que hay que abonar para separar, y cómo enviarlo. */
  deposit_amount: number | null
  deposit_instructions: string | null
  date_label: string
  time_label: string
  message: string
}

/*
 * El slug de la sede viaja en TODAS las consultas.
 *
 * No es una comodidad: sin él, el calendario pinta días en los que sólo abre
 * el otro local y las horas ofrecidas son de gente que atiende a media ciudad
 * de distancia. La clienta descubriría el error un paso después, o peor, el
 * día de la cita.
 */
function conSede(locationSlug?: Ref<string | null>): Record<string, string> {
  return locationSlug?.value ? { location: locationSlug.value } : {}
}

/** El token del cliente, si el enlace lo trae. Sólo la carga inicial lo usa. */
function conCliente(clientToken?: Ref<string | null>): Record<string, string> {
  return clientToken?.value ? { c: clientToken.value } : {}
}

export function usePublicPage(
  slug: Ref<string>,
  locationSlug?: Ref<string | null>,
  clientToken?: Ref<string | null>,
) {
  return useQuery({
    queryKey: ['public', slug, locationSlug ?? null, clientToken ?? null],
    // Es una página de marketing: no cambia entre un clic y el siguiente.
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () =>
      (
        await httpClient.get<PublicPage>(`/public/${slug.value}`, {
          params: { ...conSede(locationSlug), ...conCliente(clientToken) },
        })
      ).data,
  })
}

export function usePublicDays(
  slug: Ref<string>,
  serviceId: Ref<number | null>,
  from: Ref<string>,
  resourceId: Ref<number | null>,
  days?: Ref<number>,
  locationSlug?: Ref<string | null>,
) {
  return useQuery({
    queryKey: [
      'public',
      slug,
      'days',
      serviceId,
      from,
      resourceId,
      days ?? 14,
      locationSlug ?? null,
    ],
    enabled: () => serviceId.value !== null,
    queryFn: async () =>
      (
        await httpClient.get<{ days: Array<{ date: string; has_slots: boolean }> }>(
          `/public/${slug.value}/days`,
          {
            params: {
              service_id: serviceId.value,
              from: from.value,
              ...(days ? { days: days.value } : {}),
              ...(resourceId.value ? { resource_id: resourceId.value } : {}),
              ...conSede(locationSlug),
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
  locationSlug?: Ref<string | null>,
) {
  return useQuery({
    queryKey: ['public', slug, 'slots', serviceId, date, resourceId, locationSlug ?? null],
    enabled: () => serviceId.value !== null && date.value !== null,
    queryFn: async () =>
      (
        await httpClient.get<{ slots: PublicSlot[] }>(`/public/${slug.value}/availability`, {
          params: {
            service_id: serviceId.value,
            date: date.value,
            ...(resourceId.value ? { resource_id: resourceId.value } : {}),
            ...conSede(locationSlug),
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
  serviceIds?: Ref<number[]>,
  locationSlug?: Ref<string | null>,
) {
  return useQuery({
    queryKey: [
      'public',
      slug,
      'chain',
      packageId,
      serviceIds ?? [],
      date,
      resourceId,
      locationSlug ?? null,
    ],
    enabled: () =>
      date.value !== null && (packageId.value !== null || (serviceIds?.value.length ?? 0) > 0),
    queryFn: async () =>
      (
        await httpClient.get<{ slots: PublicChainSlot[] }>(
          `/public/${slug.value}/availability/chain`,
          {
            params: {
              // Un combo manda sobre una selección suelta: el combo trae su
              // descuento y sus servicios ya definidos.
              ...(packageId.value
                ? { package_id: packageId.value }
                : { 'service_ids[]': serviceIds?.value ?? [] }),
              date: date.value,
              ...(resourceId.value ? { resource_id: resourceId.value } : {}),
              // La sede sí es filtro, a diferencia de la persona: nadie cruza
              // la ciudad entre el manicure y el pedicure.
              ...conSede(locationSlug),
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
      client_email: string
      notes?: string | null
    }) =>
      (await httpClient.post<BookingResult>(`/public/${slug.value}/appointments`, payload)).data,
  })
}
