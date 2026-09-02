import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| La bandeja de salida
|------------------------------------------------------------------------------
| Todo lo que el sistema quiso mandar. Existe sobre todo por el MODO MANUAL —
| como opera un negocio mientras no tenga un número de WhatsApp aprobado, y como
| van a querer seguir operando algunos.
|
| Sin esta pantalla, un aviso que el sistema preparó no lo ve nadie: se pierde
| igual que antes, sólo que ahora en una tabla.
*/

export interface OutboxMessage {
  id: number
  kind: string
  status: string
  status_label: string
  to: string
  client_name: string | null
  body: string
  location: string | null
  error: string | null
  created_at: string
  sent_at: string | null
  /** El chat con esa persona y el texto adentro, sin copiar ni buscar contacto. */
  whatsapp_url: string
}

export interface OutboxPayload {
  data: OutboxMessage[]
  /** Cuántos faltan por hacer. Es lo que va en el badge del menú. */
  pending: number
  mode: string
  /** Si a este negocio le salen los mensajes solos. */
  sends_by_itself: boolean
}

export function useMessages(status: Ref<string | null>, locationId?: Ref<number | null>) {
  return useQuery({
    queryKey: ['messages', status, locationId ?? null],
    queryFn: async () =>
      (
        await httpClient.get<OutboxPayload>('/messages', {
          params: {
            ...(status.value ? { status: status.value } : {}),
            ...(locationId?.value ? { location_id: locationId.value } : {}),
          },
        })
      ).data,
  })
}

export function useMarkSent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.post(`/messages/${id}/sent`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages'] }),
  })
}

export function useRetryMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.post(`/messages/${id}/retry`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages'] }),
  })
}

export function useDiscardMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.delete(`/messages/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages'] }),
  })
}

/** Cómo se llama cada tipo en pantalla. `etapa` no le dice nada a nadie. */
export const KIND_LABELS: Record<string, string> = {
  recordatorio: 'Recordatorio',
  encuesta: 'Encuesta',
  etapa: 'Aviso de cita',
  equipo: 'Aviso al equipo',
  lista_espera: 'Se liberó un cupo',
  agente: 'Respuesta del agente',
}
