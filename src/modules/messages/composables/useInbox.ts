import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| La bandeja de WhatsApp
|------------------------------------------------------------------------------
| Leer lo que escriben las clientas y contestarles a mano.
|
| Existe porque migrar un local que hoy trabaja en ManyChat significa
| reemplazar TODO lo que ManyChat le da, no sólo lo automático: ahí hay gente
| contestando. Sin esta pantalla, cambiar de sistema sería quitarles una
| herramienta que usan todos los días.
|
| DOS COSAS QUE LA PANTALLA TIENE QUE MOSTRAR SIEMPRE, porque son las dos
| razones por las que un mensaje puede no salir:
|
|  - La VENTANA de 24 horas. Fuera de ella Meta sólo entrega plantillas
|    aprobadas, y el intento no falla con un error: lo acepta y no lo entrega.
|    Es regla de Meta, no del sistema — ManyChat vive con la misma.
|
|  - El RELEVO. Cuando alguien contesta a mano, el agente se calla en esa
|    conversación por un rato. Se muestra hasta cuándo, para que nadie crea
|    que el agente se murió.
*/

export interface InboxConversation {
  id: number
  phone: string
  client: { id: number; name: string } | null
  status: 'open' | 'closed'
  unread: boolean
  last_message_at: string | null
  /** Si todavía se puede mandar texto libre. */
  window_open: boolean
  window_closes_at: string | null
  /** Si el agente está callado porque alguien tomó la conversación. */
  agent_paused: boolean
  agent_resumes_at: string | null
  assigned_to: string | null
}

export interface InboxMessage {
  id: number
  direction: 'in' | 'out'
  kind: string
  body: string
  status: string
  error: string | null
  at: string | null
}

export interface InboxPayload {
  data: InboxConversation[]
  /** Cuántas esperan respuesta. Es lo que va en el badge del menú. */
  unread: number
}

export function useInbox(status: Ref<string>, search: Ref<string>) {
  return useQuery({
    queryKey: ['inbox', status, search],
    queryFn: async () =>
      (
        await httpClient.get<InboxPayload>('/whatsapp/inbox', {
          params: { status: status.value, q: search.value || undefined },
        })
      ).data,
    /*
     * Se refresca sola: una bandeja que sólo se actualiza al recargar la
     * página deja a una clienta esperando sin que nadie lo note. Treinta
     * segundos es lo que alguien tolera de espera en un mostrador.
     */
    refetchInterval: 30_000,
  })
}

export function useConversation(id: Ref<number | null>) {
  return useQuery({
    queryKey: ['inbox', 'thread', id],
    enabled: () => id.value !== null,
    queryFn: async () =>
      (
        await httpClient.get<{ conversation: InboxConversation; messages: InboxMessage[] }>(
          `/whatsapp/inbox/${id.value}`,
        )
      ).data,
    refetchInterval: 15_000,
  })
}

export function useReply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: string }) =>
      (await httpClient.post(`/whatsapp/inbox/${id}/reply`, { body })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
  })
}

export function useResumeAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) =>
      (await httpClient.post(`/whatsapp/inbox/${id}/resume-agent`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
  })
}

export function useToggleConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.post(`/whatsapp/inbox/${id}/toggle`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
  })
}
