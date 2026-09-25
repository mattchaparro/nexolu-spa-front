<script setup lang="ts">
/*
 * El asistente del panel: se le pregunta en palabras.
 *
 * «¿Cuánto vendí hoy?», «¿qué servicios se hicieron más esta semana?»,
 * «¿quiénes escriben y no agendan?», «bloquéale a Alejandra el viernes de 5 a
 * 6». Leer tablas para sacar una respuesta es lo que cansa; esto la da en una
 * frase, con las mismas cuentas del Resumen y de Ventas. Lo que escribe (un
 * bloqueo) llega como tarjeta y solo se hace al confirmarla.
 */
import { nextTick, ref, watch } from 'vue'

import { NxButton, NxInput } from '@/ui'

import { useAssistant, type AssistantDraft } from '../composables/useAssistant'
import { parseRichText } from '../support/richText'

const { messages, drafts, busy, send, resolvingId, draftError, resolveDraft } = useAssistant()

const text = ref('')

const SUGERENCIAS = [
  '¿Cuánto vendí hoy?',
  '¿Qué servicios se hicieron más esta semana?',
  '¿Quiénes escriben pero no agendan?',
  '¿Qué citas hay mañana?',
  'Bloquéale a Alejandra el viernes de 5 a 6',
]

function enviar(pregunta?: string): void {
  const mensaje = (pregunta ?? text.value).trim()
  if (!mensaje) return
  text.value = ''
  void send(mensaje)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    enviar()
  }
}

/** Copia editable de cada tarjeta: corregir aquí es más corto que volver a dictarlo. */
const editados = ref<Record<string, Record<string, unknown>>>({})

watch(
  drafts,
  (lista) => {
    for (const d of lista) {
      editados.value[d.id] ??= { ...d.values }
    }
  },
  { deep: true, immediate: true },
)

function campos(d: AssistantDraft): Array<{ key: string; label: string }> {
  const declarados = Object.entries(d.fields ?? {}).map(([key, f]) => ({ key, label: f?.label ?? key }))
  const extra = Object.keys(d.values ?? {})
    .filter((k) => !declarados.some((c) => c.key === k))
    .map((key) => ({ key, label: key }))
  return [...declarados, ...extra]
}

function confirmar(d: AssistantDraft): void {
  const valores = Object.fromEntries(
    Object.entries(editados.value[d.id] ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  )
  void resolveDraft(d.id, 'confirm', valores)
}

const fin = ref<HTMLElement | null>(null)
watch(
  () => [messages.value.length, drafts.value.length],
  async () => {
    await nextTick()
    fin.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  },
)
</script>

<template>
  <section class="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-8">
    <header>
      <h1 class="text-xl font-semibold text-slate-800">Asistente</h1>
      <p class="mt-1 text-sm text-slate-500">
        Pregúntale por ventas, agenda o clientas, o pídele que bloquee un horario.
      </p>
    </header>

    <div class="flex flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
      <div v-if="!messages.length" class="my-auto flex flex-col items-center gap-3 text-center">
        <p class="text-sm text-slate-500">Prueba con alguna de estas:</p>
        <div class="flex max-w-xl flex-wrap justify-center gap-2">
          <button
            v-for="s in SUGERENCIAS"
            :key="s"
            type="button"
            class="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
            @click="enviar(s)"
          >
            {{ s }}
          </button>
        </div>
      </div>

      <div
        v-for="m in messages"
        :key="m.id"
        class="flex"
        :class="m.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm"
          :class="[
            m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-900',
            m.failed ? '!bg-amber-50 !text-amber-800' : '',
          ]"
        >
          <template v-for="(chunk, i) in parseRichText(m.text)" :key="i">
            <strong v-if="chunk.bold">{{ chunk.text }}</strong>
            <template v-else>{{ chunk.text }}</template>
          </template>
          <span v-if="m.pending" class="inline-flex items-center gap-1 align-middle">
            <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.3s]" />
            <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.15s]" />
            <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" />
          </span>
        </div>
      </div>

      <!-- Lo que el asistente propone hacer: nada se hace hasta confirmar. -->
      <div
        v-for="d in drafts"
        :key="d.id"
        class="max-w-md rounded-xl border border-indigo-200 bg-indigo-50/40 p-4"
      >
        <p class="mb-3 text-sm font-semibold text-slate-900">{{ d.summary }}</p>
        <div class="mb-3 flex flex-col gap-2">
          <NxInput
            v-for="c in campos(d)"
            :key="c.key"
            v-model="(editados[d.id][c.key] as string)"
            :label="c.label"
            :disabled="resolvingId === d.id"
          />
        </div>
        <div class="flex gap-2">
          <NxButton size="sm" :loading="resolvingId === d.id" @click="confirmar(d)">Confirmar</NxButton>
          <NxButton
            size="sm"
            variant="outline"
            :disabled="resolvingId === d.id"
            @click="resolveDraft(d.id, 'discard')"
          >
            Descartar
          </NxButton>
        </div>
      </div>

      <div ref="fin" />
    </div>

    <p v-if="draftError" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ draftError }}</p>

    <div class="flex items-end gap-2">
      <textarea
        v-model="text"
        rows="1"
        class="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        placeholder="Escribe tu pregunta…"
        :disabled="busy"
        @keydown="onKeydown"
      />
      <button
        type="button"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400"
        :disabled="busy || !text.trim()"
        aria-label="Enviar"
        @click="enviar()"
      >
        <i class="pi pi-send text-sm" />
      </button>
    </div>
  </section>
</template>
