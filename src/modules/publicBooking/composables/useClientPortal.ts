import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| "Mis citas": el cliente, sin cuenta
|------------------------------------------------------------------------------
| Se entra por un TOKEN que llegó en el mensaje del negocio, nunca por
| teléfono. Un teléfono no es un secreto — está en la vitrina, en Instagram, en
| un grupo de WhatsApp — y dejar consultar por él convertiría esto en un
| directorio: se prueban números y salen nombres y horarios de clientas ajenas.
|
| Lo que se puede hacer es poco a propósito: ver las próximas, mover la hora y
| cancelar. Cambiar de persona, de servicio o de sede es reservar de nuevo, y
| para eso está la página pública entera.
*/

export interface PortalAppointment {
  id: number
  starts_at: string
  date_label: string
  time_label: string
  status: string
  location: string | null
  location_address: string | null
  maps_url: string | null
  items: Array<{ service: string | null; resource: string | null }>
  /** Si todavía está a tiempo de moverla o cancelarla. */
  can_change: boolean
  /** Y si no, por qué. La pantalla no reimplementa la regla del preaviso. */
  refusal: string | null
}

export interface PortalPayload {
  business: {
    name: string
    slug: string
    timezone: string
    logo_url: string | null
    whatsapp: string | null
  }
  client: { name: string; phone: string | null; email: string | null }
  appointments: PortalAppointment[]
}

function base(slug: string, token: string): string {
  return `/public/${slug}/mis-citas/${token}`
}

export function useMyAppointments(slug: Ref<string>, token: Ref<string>) {
  return useQuery({
    queryKey: ['portal', slug, token],
    // Un token inválido responde 404 y es una respuesta legítima, no una falla
    // de red: reintentarla sólo la repite.
    retry: false,
    queryFn: async () => (await httpClient.get<PortalPayload>(base(slug.value, token.value))).data,
  })
}

export function usePortalSlots(
  slug: Ref<string>,
  token: Ref<string>,
  appointmentId: Ref<number | null>,
  date: Ref<string | null>,
) {
  return useQuery({
    queryKey: ['portal', slug, token, 'slots', appointmentId, date],
    enabled: () => appointmentId.value !== null && date.value !== null,
    retry: false,
    queryFn: async () =>
      (
        await httpClient.get<{
          date: string
          resource_name: string | null
          slots: Array<{ starts_at: string; label: string }>
          /** Presente cuando la visita tiene varios servicios y hay que escribir. */
          message?: string
        }>(`${base(slug.value, token.value)}/${appointmentId.value}/slots`, {
          params: { date: date.value },
        })
      ).data,
  })
}

export function useReschedule(slug: Ref<string>, token: Ref<string>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { appointmentId: number; starts_at: string }) =>
      (
        await httpClient.post<{ date_label: string; time_label: string; message: string }>(
          `${base(slug.value, token.value)}/${payload.appointmentId}/reschedule`,
          { starts_at: payload.starts_at },
        )
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal'] }),
  })
}

export function useCancelAppointment(slug: Ref<string>, token: Ref<string>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (appointmentId: number) =>
      (
        await httpClient.post<{ message: string }>(
          `${base(slug.value, token.value)}/${appointmentId}/cancel`,
        )
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['portal'] }),
  })
}
