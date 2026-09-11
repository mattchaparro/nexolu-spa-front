import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| Difusiones de WhatsApp
|------------------------------------------------------------------------------
| La misma promoción a mucha gente. Existían sólo en el API: no había pantalla,
| así que los filtros de público no tenían desde dónde usarse.
*/

/**
 * A quiénes les llega.
 *
 * Las fechas y el número de visitas son dos ejes distintos y hacen falta los
 * dos: "premiar a la fiel" y "traer de vuelta a la que vino una vez" son las
 * dos "vino hace poco", y sólo las separa cuántas veces vino.
 */
export interface BroadcastAudience {
  location_id?: number | null
  visited_since?: string | null
  not_visited_since?: string | null
  min_visits?: number | null
  max_visits?: number | null
}

export interface Broadcast {
  id: number
  name: string
  status: string
  status_label: string
  template_name: string | null
  template_language: string | null
  template_params: string[] | null
  body_template: string
  audience: BroadcastAudience | null
  scheduled_at: string | null
  sent_at: string | null
  recipients: number | null
  editable: boolean
}

export function useBroadcasts() {
  return useQuery({
    queryKey: ['broadcasts'],
    queryFn: async () =>
      (await httpClient.get<{ data: Broadcast[]; sends_by_itself: boolean }>('/broadcasts')).data,
  })
}

export function useSaveBroadcast() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id?: number; payload: Record<string, unknown> }) =>
      (
        await (id
          ? httpClient.put<{ id: number }>(`/broadcasts/${id}`, payload)
          : httpClient.post<{ id: number }>('/broadcasts', payload))
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })
}

/**
 * Cuántas recibirían esto HOY, con una muestra de nombres.
 *
 * Antes de mandar, no después: una promoción que sale a 700 personas cuando se
 * creía que iban 40 no se puede deshacer.
 */
export function useBroadcastPreview(id: Ref<number | null>) {
  return useQuery({
    queryKey: ['broadcasts', 'preview', id],
    enabled: () => id.value !== null,
    queryFn: async () =>
      (
        await httpClient.get<{
          count: number
          sample: Array<{ nombre: string; telefono: string | null }>
        }>(`/broadcasts/${id.value}/preview`)
      ).data,
  })
}

export function useSendBroadcast() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) =>
      (await httpClient.post<{ recipients: number }>(`/broadcasts/${id}/send`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
      // Los mensajes salen a la bandeja: su contador cambia.
      queryClient.invalidateQueries({ queryKey: ['nav-badges'] })
    },
  })
}

export function useCancelBroadcast() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.post(`/broadcasts/${id}/cancel`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })
}
