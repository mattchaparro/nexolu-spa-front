import { useMutation, useQuery } from '@tanstack/vue-query'
import type { Ref } from 'vue'

import { httpClient } from '@/services/http/client'

/*
 * La lista de espera, del lado del navegador. Todo SIN sesión: la página de
 * reserva registra la espera, y el enlace del mensaje —que lleva el token—
 * consulta y toma el cupo. El token es el secreto; el teléfono nunca lo es.
 */

export type WaitlistSlot = {
  resource_id: number
  resource_name: string
  starts_at: string
  label: string
  date_label: string
}

export type WaitlistEntry = {
  business: {
    name: string
    slug: string
    timezone: string
    whatsapp: string | null
  }
  client_name: string | null
  service: string | null
  preferred_resource: string | null
  status: 'open' | 'fulfilled' | 'stopped' | 'expired'
  date_from: string | null
  date_to: string | null
  slots: WaitlistSlot[]
  /**
   * La cita que se MOVERÍA si toma un cupo, anunciada ANTES de confirmar.
   * Null cuando tomar el cupo crearía una cita nueva.
   */
  swaps: {
    appointment_id: number
    date_label: string | null
    time_label: string | null
  } | null
}

export type TakeResult = {
  message: string
  moved: boolean
  date_label: string | null
  time_label: string | null
}

/** "Avísame si se libera algo." Nace del día sin cupos en la reserva. */
export function useRegisterWaitlist(slug: Ref<string>) {
  return useMutation({
    mutationFn: async (payload: {
      service_id: number
      resource_id?: number | null
      date_from: string
      date_to: string
      location?: string | null
      client_name: string
      client_phone: string
    }) =>
      (await httpClient.post<{ message: string }>(`/public/${slug.value}/waitlist`, payload)).data,
  })
}

/** Lo que ve quien abre su enlace: los cupos que le sirven AHORA, en vivo. */
export function useWaitlistEntry(slug: Ref<string>, token: Ref<string>) {
  return useQuery({
    queryKey: ['waitlist-entry', slug, token],
    queryFn: async () =>
      (await httpClient.get<WaitlistEntry>(`/public/${slug.value}/cupo/${token.value}`)).data,
    retry: false,
  })
}

/** Tomar un cupo. El primero que llega gana; un 409 es la verdad, no un bug. */
export function useTakeSlot(slug: Ref<string>, token: Ref<string>) {
  return useMutation({
    mutationFn: async (payload: { resource_id: number; starts_at: string }) =>
      (
        await httpClient.post<TakeResult>(
          `/public/${slug.value}/cupo/${token.value}/take`,
          payload,
        )
      ).data,
  })
}

/** "Ya no me avisen." */
export function useStopWaitlist(slug: Ref<string>, token: Ref<string>) {
  return useMutation({
    mutationFn: async () =>
      (await httpClient.post<{ message: string }>(`/public/${slug.value}/cupo/${token.value}/stop`))
        .data,
  })
}
