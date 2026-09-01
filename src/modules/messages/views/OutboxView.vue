<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import LocationPicker from '@/modules/settings/components/LocationPicker.vue'
import { extractErrorMessage } from '@/utils/extractErrorMessage'

import {
  KIND_LABELS,
  useDiscardMessage,
  useMarkSent,
  useMessages,
  useRetryMessage,
  type OutboxMessage,
} from '../composables/useMessages'

/*
 * "Mensajes por enviar".
 *
 * La pantalla que hace operable el modo manual: el sistema prepara el mensaje,
 * y una persona lo manda desde su propio WhatsApp. Está pensada para hacerse de
 * corrido — abrir, tocar «Enviar», volver, marcar — no para leerse.
 */
const { notify } = useSystemAlert()

const status = ref<string | null>(null)
const locationId = ref<number | null>(null)

const { data, isLoading } = useMessages(status, locationId)
const { mutateAsync: markSent } = useMarkSent()
const { mutateAsync: retry, isPending: retrying } = useRetryMessage()
const { mutateAsync: discard } = useDiscardMessage()

const messages = computed(() => data.value?.data ?? [])
const auto = computed(() => data.value?.sends_by_itself === true)

const FILTERS = [
  { value: null, label: 'Por hacer' },
  { value: 'enviado', label: 'Enviados' },
  { value: 'fallido', label: 'Fallaron' },
]

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind
}

function fecha(iso: string | null): string {
  if (!iso) return ''

  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Abrir WhatsApp y marcar como enviado, en un gesto.
 *
 * Separarlos haría que la lista se llene de mensajes ya mandados que nadie
 * marcó — y una lista que no distingue lo que falta de lo que se hizo deja de
 * servir a los dos días.
 */
async function enviar(message: OutboxMessage): Promise<void> {
  window.open(message.whatsapp_url, '_blank', 'noopener')

  try {
    await markSent(message.id)
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos marcarlo como enviado.'), 'error')
  }
}

async function reintentar(message: OutboxMessage): Promise<void> {
  try {
    const r = await retry(message.id)
    notify(r.message, 'success')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos reintentarlo.'), 'error')
  }
}

async function descartar(message: OutboxMessage): Promise<void> {
  if (!window.confirm('¿Descartar este mensaje? No se va a enviar.')) return

  await discard(message.id)
  notify('Descartado.', 'success')
}

async function copiar(message: OutboxMessage): Promise<void> {
  try {
    await navigator.clipboard.writeText(message.body)
    notify('Texto copiado.', 'success')
  } catch {
    window.prompt('Copia el mensaje:', message.body)
  }
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Mensajes por enviar</h1>
        <p class="mt-1 max-w-2xl text-sm text-slate-500">
          Lo que el sistema preparó para tus clientas. Tócale «Enviar» y se abre WhatsApp con el
          texto listo.
        </p>
      </div>

      <LocationPicker v-model="locationId" label="Sede" />
    </header>

    <!-- Que los mensajes salgan solos o no cambia todo lo que se ve acá, así
         que se dice arriba y no en una pantalla de configuración. -->
    <p v-if="auto" class="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      Este negocio envía solo. Acá sólo verás lo que falló.
    </p>
    <p v-else class="mb-4 rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-700">
      Todavía no hay WhatsApp conectado, así que los mensajes los mandas tú. Es normal: la mayoría
      de los negocios arrancan así.
    </p>

    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="f in FILTERS"
        :key="f.label"
        type="button"
        class="rounded-full border px-3 py-1.5 text-sm transition"
        :class="
          status === f.value
            ? 'border-slate-800 bg-slate-800 text-white'
            : 'border-slate-200 bg-white text-slate-600'
        "
        @click="status = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p
      v-else-if="!messages.length"
      class="rounded-lg bg-slate-100 px-4 py-10 text-center text-sm text-slate-600"
    >
      Nada por enviar. Al día.
    </p>

    <div v-else class="flex flex-col gap-3">
      <article
        v-for="m in messages"
        :key="m.id"
        class="rounded-lg border bg-white p-4"
        :class="m.error ? 'border-red-200' : 'border-slate-200'"
      >
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="font-medium text-slate-800">
            {{ m.client_name ?? m.to }}
            <span class="ml-1 text-xs font-normal text-slate-500">{{ kindLabel(m.kind) }}</span>
          </p>
          <p class="text-xs text-slate-400">
            {{ fecha(m.created_at) }}
            <span v-if="m.location"> · {{ m.location }}</span>
          </p>
        </div>

        <!-- El texto completo, no un resumen: quien lo va a mandar tiene que
             poder leer qué dice antes de mandarlo a su nombre. -->
        <p class="mt-2 whitespace-pre-line rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {{ m.body }}
        </p>

        <p v-if="m.error" class="mt-2 text-xs text-red-700">
          <!-- El motivo, no un "falló": entre un timeout y un número inválido
               está la diferencia entre reintentar y corregir la ficha. -->
          {{ m.error }}
        </p>

        <div v-if="m.status !== 'enviado'" class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="min-h-10 rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm text-emerald-900"
            @click="enviar(m)"
          >
            Enviar por WhatsApp
          </button>
          <button
            type="button"
            class="min-h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-600"
            @click="copiar(m)"
          >
            Copiar texto
          </button>
          <button
            v-if="auto && m.status === 'fallido'"
            type="button"
            class="min-h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-600"
            :disabled="retrying"
            @click="reintentar(m)"
          >
            Reintentar
          </button>
          <button
            type="button"
            class="min-h-10 rounded-lg px-3 text-sm text-slate-400"
            @click="descartar(m)"
          >
            Descartar
          </button>
        </div>

        <p v-else class="mt-2 text-xs text-emerald-700">Enviado {{ fecha(m.sent_at) }}</p>
      </article>
    </div>
  </section>
</template>
