<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { extractErrorMessage } from '@/utils/extractErrorMessage'

import {
  useStopWaitlist,
  useTakeSlot,
  useWaitlistEntry,
  type TakeResult,
  type WaitlistSlot,
} from '../composables/useWaitlist'

/*
 * "Se liberó un cupo": la página del enlace de la lista de espera.
 *
 * Muestra los cupos que sirven AHORA, no el del mensaje: un aviso de hace una
 * hora sigue siendo útil aunque ese cupo puntual ya se haya ido. Y si tomar
 * un cupo va a MOVER una cita que ya tiene, se dice ANTES de tocar: mover una
 * cita sin permiso no se hace, ni con buenas intenciones.
 */
const route = useRoute()

const slug = computed(() => String(route.params.businessSlug ?? ''))
const token = computed(() => String(route.params.token ?? ''))

const { data, isLoading, isError, refetch } = useWaitlistEntry(slug, token)
const { mutateAsync: tomar, isPending: tomando } = useTakeSlot(slug, token)
const { mutateAsync: parar, isPending: parando } = useStopWaitlist(slug, token)

/** El cupo que está por confirmar. Un toque elige, el segundo confirma. */
const elegido = ref<WaitlistSlot | null>(null)
const listo = ref<TakeResult | null>(null)
const aviso = ref<string | null>(null)
const error = ref<string | null>(null)
const detenido = ref(false)

/** Los cupos agrupados por día, en el orden en que llegan (ya vienen por hora). */
const porDia = computed(() => {
  const grupos: Array<{ label: string; slots: WaitlistSlot[] }> = []

  for (const slot of data.value?.slots ?? []) {
    const ultimo = grupos[grupos.length - 1]

    if (ultimo && ultimo.label === slot.date_label) {
      ultimo.slots.push(slot)
    } else {
      grupos.push({ label: slot.date_label, slots: [slot] })
    }
  }

  return grupos
})

async function confirmar(): Promise<void> {
  if (!elegido.value) return

  error.value = null
  aviso.value = null

  try {
    listo.value = await tomar({
      resource_id: elegido.value.resource_id,
      starts_at: elegido.value.starts_at,
    })
  } catch (e) {
    const status = (e as { response?: { status?: number } })?.response?.status

    if (status === 409) {
      /*
       * Alguien llegó primero. El mensaje ya lo advertía y la espera sigue
       * abierta: se recargan los cupos en vez de dejar a la persona ante un
       * botón muerto.
       */
      aviso.value = extractErrorMessage(e, 'Ese cupo ya lo tomó alguien más.')
      elegido.value = null
      await refetch()
    } else {
      error.value = extractErrorMessage(e, 'No se pudo tomar el cupo. Intenta de nuevo.')
    }
  }
}

async function yaNoAvisar(): Promise<void> {
  error.value = null

  try {
    await parar()
    detenido.value = true
  } catch (e) {
    error.value = extractErrorMessage(e, 'No se pudo guardar. Intenta de nuevo.')
  }
}

const whatsappUrl = computed(() => {
  const numero = data.value?.business.whatsapp?.replace(/\D/g, '')
  return numero ? `https://wa.me/${numero}` : null
})
</script>

<template>
  <div class="min-h-screen bg-white">
    <p v-if="isLoading" class="p-10 text-center text-slate-500">Cargando…</p>

    <!-- Enlace vencido, mal copiado o de otro negocio: se ven igual a propósito. -->
    <div v-else-if="isError || !data" class="flex min-h-screen items-center justify-center p-8">
      <div class="max-w-sm text-center">
        <p class="text-lg font-medium text-slate-800">Este enlace ya no sirve</p>
        <p class="mt-2 text-sm text-slate-500">
          Escríbele al negocio y con gusto te ayudan con tu cita.
        </p>
      </div>
    </div>

    <template v-else>
      <header class="border-b border-slate-100 px-5 py-4">
        <div class="mx-auto max-w-lg">
          <p class="font-semibold text-slate-900">{{ data.business.name }}</p>
          <p class="text-xs text-slate-500">
            {{ data.service }}
            <template v-if="data.preferred_resource"> · con {{ data.preferred_resource }}</template>
          </p>
        </div>
      </header>

      <main class="mx-auto max-w-lg px-5 py-6">
        <!-- Ya quedó: nada más que hacer aquí. -->
        <div v-if="listo" class="rounded-xl bg-emerald-50 p-5 text-emerald-900">
          <p class="font-medium">{{ listo.message }}</p>
          <p class="mt-1 text-sm">
            {{ listo.moved ? 'Tu cita quedó para el' : 'Te esperamos el' }}
            <span class="font-medium first-letter:uppercase">{{ listo.date_label }}</span>
            a las {{ listo.time_label }}.
          </p>
        </div>

        <div v-else-if="detenido" class="rounded-xl bg-slate-50 p-5 text-slate-700">
          <p>Listo, no te avisamos más.</p>
        </div>

        <template v-else-if="data.status !== 'open'">
          <div class="rounded-xl bg-slate-50 p-5 text-slate-700">
            <p v-if="data.status === 'fulfilled'">Esta espera ya terminó: el cupo quedó tomado.</p>
            <p v-else>Esta espera ya no está activa.</p>
            <a
              v-if="whatsappUrl"
              :href="whatsappUrl"
              class="mt-3 inline-block text-sm font-medium text-indigo-700"
            >
              Escribir al negocio
            </a>
          </div>
        </template>

        <template v-else>
          <p v-if="aviso" class="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {{ aviso }}
          </p>
          <p v-if="error" class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            {{ error }}
          </p>

          <template v-if="porDia.length">
            <p class="text-sm text-slate-600">
              Hay cupo. Es para quien lo tome primero — elige tu hora:
            </p>

            <!-- El traslado, dicho ANTES del botón de confirmar. -->
            <p
              v-if="data.swaps"
              class="mt-3 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-900"
            >
              Ya tienes una cita el
              <span class="font-medium first-letter:uppercase">{{ data.swaps.date_label }}</span>
              a las {{ data.swaps.time_label }}. Si tomas un cupo,
              <span class="font-medium">esa cita se mueve</span> al nuevo horario — no se crea otra.
            </p>

            <div v-for="grupo in porDia" :key="grupo.label" class="mt-4">
              <p class="mb-1.5 text-xs text-slate-400 first-letter:uppercase">{{ grupo.label }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="slot in grupo.slots"
                  :key="slot.starts_at + slot.resource_id"
                  type="button"
                  class="min-h-11 rounded-xl border px-3 text-sm active:bg-slate-50"
                  :class="
                    elegido?.starts_at === slot.starts_at &&
                    elegido?.resource_id === slot.resource_id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 bg-white text-slate-800'
                  "
                  @click="elegido = slot"
                >
                  {{ slot.label }}
                  <span class="ml-1 text-xs text-slate-400">{{ slot.resource_name }}</span>
                </button>
              </div>
            </div>

            <button
              v-if="elegido"
              type="button"
              class="mt-5 min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-50"
              :disabled="tomando"
              @click="confirmar"
            >
              {{ data.swaps ? 'Mover mi cita a esta hora' : 'Tomar este cupo' }}
            </button>
          </template>

          <div v-else class="rounded-xl bg-slate-50 p-5 text-slate-700">
            <p class="text-sm">
              Ahora mismo no hay cupos que te sirvan. Sigues en la lista: si se libera otro, te
              avisamos.
            </p>
          </div>

          <button
            type="button"
            class="mt-8 text-xs text-slate-400 underline"
            :disabled="parando"
            @click="yaNoAvisar"
          >
            Ya no me avisen de esta espera
          </button>
        </template>
      </main>
    </template>
  </div>
</template>
