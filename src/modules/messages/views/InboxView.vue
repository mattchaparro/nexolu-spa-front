<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { extractErrorMessage } from '@/utils/extractErrorMessage'

import {
  useConversation,
  useInbox,
  useReply,
  useResumeAgent,
  useToggleConversation,
  type InboxConversation,
} from '../composables/useInbox'

/*
 * La bandeja de WhatsApp.
 *
 * Dos paneles en escritorio y uno en el teléfono: en una pantalla chica, ver
 * la lista Y el hilo a la vez no deja espacio para ninguno de los dos, y esta
 * pantalla se usa de pie en el mostrador.
 *
 * Lo que más importa acá no es el chat — eso lo sabe hacer cualquiera — sino
 * decir POR QUÉ no se puede escribir cuando no se puede. Hay dos motivos y se
 * arreglan distinto: la ventana de 24 horas de Meta (hay que esperar a que
 * ella escriba) y el relevo del agente (se suelta con un botón).
 */
const { notify } = useSystemAlert()

const status = ref<'open' | 'closed' | 'all'>('open')
const search = ref('')
const selectedId = ref<number | null>(null)
const draft = ref('')
const hilo = ref<HTMLElement | null>(null)

const { data, isLoading } = useInbox(status, search)
const { data: thread, isLoading: loadingThread } = useConversation(selectedId)
const { mutateAsync: reply, isPending: sending } = useReply()
const { mutateAsync: resumeAgent } = useResumeAgent()
const { mutateAsync: toggle } = useToggleConversation()

const conversations = computed(() => data.value?.data ?? [])
const current = computed(() => thread.value?.conversation ?? null)
const messages = computed(() => thread.value?.messages ?? [])

const FILTERS = [
  { value: 'open' as const, label: 'Abiertas' },
  { value: 'closed' as const, label: 'Cerradas' },
  { value: 'all' as const, label: 'Todas' },
]

// El hilo se lee de abajo hacia arriba: lo último es lo que importa.
watch(messages, async () => {
  await nextTick()
  if (hilo.value) hilo.value.scrollTop = hilo.value.scrollHeight
})

function nombre(c: InboxConversation): string {
  return c.client?.name ?? c.phone
}

function hora(iso: string | null): string {
  if (!iso) return ''

  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Cuánto falta para que se cierre la ventana, en palabras. */
const ventanaRestante = computed(() => {
  if (!current.value?.window_closes_at) return null

  const faltan = new Date(current.value.window_closes_at).getTime() - Date.now()

  if (faltan <= 0) return null

  const horas = Math.floor(faltan / 3_600_000)

  return horas >= 1 ? `${horas} h` : `${Math.max(1, Math.round(faltan / 60_000))} min`
})

async function enviar() {
  if (!selectedId.value || !draft.value.trim()) return

  try {
    await reply({ id: selectedId.value, body: draft.value.trim() })
    draft.value = ''
  } catch (e) {
    notify(extractErrorMessage(e), 'error')
  }
}

async function devolverAlAgente() {
  if (!selectedId.value) return

  try {
    await resumeAgent(selectedId.value)
    notify('El agente vuelve a contestar esta conversación.', 'success')
  } catch (e) {
    notify(extractErrorMessage(e), 'error')
  }
}

async function cerrarOAbrir() {
  if (!selectedId.value) return

  try {
    await toggle(selectedId.value)
  } catch (e) {
    notify(extractErrorMessage(e), 'error')
  }
}
</script>

<template>
  <section class="flex h-[calc(100vh-4rem)] flex-col p-4 md:p-6">
    <header class="mb-4">
      <h1 class="text-xl font-semibold text-slate-800">WhatsApp</h1>
      <p class="mt-1 max-w-2xl text-sm text-slate-500">
        Lo que te escriben tus clientas. Si contestas tú, el agente se calla en esa conversación
        para no responder encima.
      </p>
    </header>

    <div class="flex min-h-0 flex-1 gap-4">
      <!-- Lista. En el teléfono desaparece cuando hay una conversación abierta. -->
      <aside
        class="flex w-full min-w-0 flex-col md:w-80 md:shrink-0"
        :class="selectedId !== null ? 'hidden md:flex' : 'flex'"
      >
        <input
          v-model="search"
          type="search"
          placeholder="Buscar por nombre o teléfono"
          class="mb-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        />

        <div class="mb-2 flex gap-2">
          <button
            v-for="f in FILTERS"
            :key="f.value"
            type="button"
            class="rounded-full border px-3 py-1 text-xs transition"
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
          v-else-if="!conversations.length"
          class="rounded-lg bg-slate-100 px-4 py-8 text-center text-sm text-slate-600"
        >
          Nada por contestar.
        </p>

        <ul v-else class="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          <li v-for="c in conversations" :key="c.id">
            <button
              type="button"
              class="flex w-full items-start gap-2 border-b border-slate-100 px-3 py-3 text-left transition hover:bg-slate-50"
              :class="selectedId === c.id ? 'bg-slate-100' : ''"
              @click="selectedId = c.id"
            >
              <!-- Un punto y no un número: lo que hace falta saber es si hay
                   algo sin contestar, no cuántos mensajes son. -->
              <span
                class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                :class="c.unread ? 'bg-emerald-500' : 'bg-transparent'"
              />

              <span class="min-w-0 flex-1">
                <span class="flex items-baseline justify-between gap-2">
                  <span class="truncate text-sm font-medium text-slate-800">{{ nombre(c) }}</span>
                  <span class="shrink-0 text-xs text-slate-400">{{ hora(c.last_message_at) }}</span>
                </span>

                <span class="mt-0.5 flex flex-wrap gap-1.5 text-xs">
                  <span v-if="c.agent_paused" class="text-amber-700">
                    <i class="pi pi-user" /> {{ c.assigned_to ?? 'Atendida por el equipo' }}
                  </span>
                  <span v-else-if="!c.window_open" class="text-slate-400">Fuera de las 24 h</span>
                  <span v-if="c.status === 'closed'" class="text-slate-400">· Cerrada</span>
                </span>
              </span>
            </button>
          </li>
        </ul>
      </aside>

      <!-- El hilo -->
      <div
        class="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-slate-200 bg-white"
        :class="selectedId === null ? 'hidden md:flex' : 'flex'"
      >
        <p
          v-if="selectedId === null"
          class="m-auto px-6 text-center text-sm text-slate-500"
        >
          Elige una conversación.
        </p>

        <template v-else>
          <div class="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <button
              type="button"
              class="text-slate-500 md:hidden"
              aria-label="Volver"
              @click="selectedId = null"
            >
              <i class="pi pi-arrow-left" />
            </button>

            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-slate-800">
                {{ current ? nombre(current) : '' }}
              </p>
              <p class="text-xs text-slate-400">{{ current?.phone }}</p>
            </div>

            <button
              type="button"
              class="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
              @click="cerrarOAbrir"
            >
              {{ current?.status === 'closed' ? 'Reabrir' : 'Cerrar' }}
            </button>
          </div>

          <!--
            El relevo. Se dice quién atiende y hasta cuándo, porque si no
            alguien va a pensar que el agente se murió.
          -->
          <p
            v-if="current?.agent_paused"
            class="flex flex-wrap items-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-900"
          >
            <span>
              El agente no está contestando esta conversación
              <span v-if="current.assigned_to">— la tomó {{ current.assigned_to }}</span>.
            </span>
            <button type="button" class="font-medium underline" @click="devolverAlAgente">
              Devolvérsela
            </button>
          </p>

          <div ref="hilo" class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <p v-if="loadingThread" class="text-sm text-slate-500">Cargando…</p>

            <div v-else class="flex flex-col gap-2">
              <div
                v-for="m in messages"
                :key="m.id"
                class="flex"
                :class="m.direction === 'in' ? 'justify-start' : 'justify-end'"
              >
                <div
                  class="max-w-[80%] rounded-lg px-3 py-2 text-sm"
                  :class="
                    m.direction === 'in'
                      ? 'bg-slate-100 text-slate-800'
                      : 'bg-emerald-600 text-white'
                  "
                >
                  <p class="whitespace-pre-line">{{ m.body }}</p>
                  <p
                    class="mt-1 text-[11px]"
                    :class="m.direction === 'in' ? 'text-slate-400' : 'text-emerald-100'"
                  >
                    {{ hora(m.at) }}
                    <span v-if="m.kind === 'agente'"> · agente</span>
                    <span v-if="m.status === 'fallido'"> · no salió</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!--
            La ventana de 24 horas.
            No es una limitación nuestra: Meta sólo entrega texto libre dentro
            de las 24 h siguientes al último mensaje de la persona. Y no falla
            con un error — lo acepta y no lo entrega —, así que hay que
            cortarlo acá y explicarlo.
          -->
          <div class="border-t border-slate-200 p-3">
            <p
              v-if="current && !current.window_open"
              class="rounded-md bg-slate-100 px-3 py-3 text-xs text-slate-600"
            >
              Pasaron más de 24 horas desde su último mensaje. WhatsApp no deja escribirle texto
              libre hasta que ella vuelva a escribir. Es una regla de Meta, no del sistema.
            </p>

            <form v-else class="flex items-end gap-2" @submit.prevent="enviar">
              <textarea
                v-model="draft"
                rows="2"
                placeholder="Escribe tu respuesta…"
                class="min-w-0 flex-1 resize-none rounded-md border border-slate-200 px-3 py-2 text-sm"
                @keydown.enter.exact.prevent="enviar"
              />
              <button
                type="submit"
                class="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                :disabled="sending || !draft.trim()"
              >
                Enviar
              </button>
            </form>

            <p v-if="ventanaRestante" class="mt-1.5 text-[11px] text-slate-400">
              Puedes escribirle {{ ventanaRestante }} más.
            </p>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
