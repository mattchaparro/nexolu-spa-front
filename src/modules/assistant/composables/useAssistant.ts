import { ref } from 'vue'

import { httpClient } from '@/services/http/client'
import { extractErrorMessage } from '@/utils/extractErrorMessage'

/** Lo que el asistente propone escribir y la persona confirma en una tarjeta. */
export interface AssistantDraft {
  id: string
  tool_type: string
  status: string
  summary: string
  fields: Record<string, { label?: string; type?: string }>
  values: Record<string, unknown>
}

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  pending: boolean
  /** No pudo responder: se pinta como aviso, no como respuesta. */
  failed?: boolean
}

interface ChatResponse {
  conversation_id: string | null
  text: string
  drafts: AssistantDraft[]
  tools_used: string[]
}

/**
 * Una conversación con el asistente del panel. Estado local, no de servidor:
 * es una charla en vivo, no algo que se cachea.
 */
export function useAssistant() {
  const messages = ref<AssistantMessage[]>([])
  const conversationId = ref<string | null>(null)
  const drafts = ref<AssistantDraft[]>([])
  const busy = ref(false)

  async function send(text: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed || busy.value) return

    messages.value.push({ id: crypto.randomUUID(), role: 'user', text: trimmed, pending: false })
    messages.value.push({ id: crypto.randomUUID(), role: 'assistant', text: '', pending: true })
    // Se relee del array: push() guarda el objeto crudo y lo que vuelve es el
    // proxy reactivo; mutar la referencia local no repinta la pantalla.
    const respuesta = messages.value[messages.value.length - 1]
    busy.value = true

    try {
      const { data } = await httpClient.post<ChatResponse>(
        '/assistant/chat',
        { message: trimmed, conversation_id: conversationId.value },
        // El asistente consulta varias herramientas antes de contestar: los
        // 20 segundos por defecto lo cortaban a mitad de la respuesta.
        { timeout: 90_000 },
      )
      conversationId.value = data.conversation_id
      respuesta.text = data.text || (data.drafts.length ? 'Revisa la tarjeta y confirma 👇' : 'Listo.')
      drafts.value.push(...data.drafts)
    } catch (e) {
      respuesta.text = extractErrorMessage(e, 'Tuve un inconveniente para responder. Intenta de nuevo.')
      respuesta.failed = true
    } finally {
      respuesta.pending = false
      busy.value = false
    }
  }

  const resolvingId = ref<string | null>(null)
  const draftError = ref<string | null>(null)

  async function resolveDraft(id: string, action: 'confirm' | 'discard', values?: Record<string, unknown>): Promise<void> {
    resolvingId.value = id
    draftError.value = null

    try {
      await httpClient.post(`/assistant/drafts/${id}/${action}`, action === 'confirm' ? { values } : {})
      const draft = drafts.value.find((d) => d.id === id)
      drafts.value = drafts.value.filter((d) => d.id !== id)
      messages.value.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        text: action === 'confirm' ? `✅ Hecho: ${draft?.summary ?? ''}` : 'Descartado.',
        pending: false,
      })
    } catch (e) {
      draftError.value = extractErrorMessage(e, 'No pudimos completar la acción.')
    } finally {
      resolvingId.value = null
    }
  }

  return { messages, drafts, busy, send, resolvingId, draftError, resolveDraft }
}
