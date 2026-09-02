<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import LocationPicker from '@/modules/settings/components/LocationPicker.vue'
import { extractErrorMessage } from '@/utils/extractErrorMessage'

import {
  useStopWaitlistEntry,
  useWaitlistAdmin,
  type WaitlistAdminEntry,
} from '../composables/useWaitlistAdmin'

/*
 * "Lista de espera": quiénes están esperando un cupo que no había.
 *
 * Sirve para dos cosas en el mostrador: saber cuánta demanda se está
 * quedando por fuera (¿abrimos otro puesto los sábados?), y cerrar la espera
 * de quien llama a decir "ya no, gracias". Agendar a alguien de la lista es
 * agendar normal — la espera se cierra sola al crear la cita.
 */
const { notify } = useSystemAlert()

const status = ref<string | null>(null)
const locationId = ref<number | null>(null)

const { data, isLoading } = useWaitlistAdmin(status, locationId)
const { mutateAsync: stop, isPending: stopping } = useStopWaitlistEntry()

const entries = computed(() => data.value?.data ?? [])

const FILTERS = [
  { value: null, label: 'Esperando' },
  { value: 'fulfilled', label: 'Consiguieron cupo' },
  { value: 'stopped', label: 'Cerradas' },
  { value: 'expired', label: 'Vencidas' },
]

function fecha(iso: string | null): string {
  if (!iso) return ''

  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function fechaHora(iso: string | null): string {
  if (!iso) return ''

  return new Date(iso).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** El chat con esa persona, para avisarle a mano si hace falta. */
function whatsappUrl(entry: WaitlistAdminEntry): string {
  return `https://wa.me/${entry.phone.replace(/\D/g, '')}`
}

async function cerrar(entry: WaitlistAdminEntry): Promise<void> {
  if (!window.confirm(`¿Cerrar la espera de ${entry.client_name ?? entry.phone}? Ya no le avisamos.`)) {
    return
  }

  try {
    await stop(entry.id)
    notify('Espera cerrada.', 'success')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos cerrarla.'), 'error')
  }
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Lista de espera</h1>
        <p class="mt-1 max-w-2xl text-sm text-slate-500">
          Quiénes pidieron que les avises si se libera un cupo. Cuando alguien cancela, el aviso
          sale solo; para agendar a alguien de acá, agéndale la cita normal y su espera se cierra
          sola.
        </p>
      </div>

      <LocationPicker v-model="locationId" label="Sede" />
    </header>

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
      v-else-if="!entries.length"
      class="rounded-lg bg-slate-100 px-4 py-10 text-center text-sm text-slate-600"
    >
      Nadie esperando cupo por ahora.
    </p>

    <div v-else class="flex flex-col gap-3">
      <article v-for="e in entries" :key="e.id" class="rounded-lg border border-slate-200 bg-white p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="font-medium text-slate-800">
            {{ e.client_name ?? e.phone }}
            <span class="ml-1 text-xs font-normal text-slate-500">{{ e.status_label }}</span>
          </p>
          <p class="text-xs text-slate-400">
            Se apuntó el {{ fechaHora(e.created_at) }}
            <span v-if="e.location"> · {{ e.location }}</span>
          </p>
        </div>

        <p class="mt-2 text-sm text-slate-700">
          {{ e.service }}
          <template v-if="e.preferred_resource"> con {{ e.preferred_resource }}</template>
          · {{ fecha(e.date_from) }} a {{ fecha(e.date_to) }}
          <template v-if="e.time_from"> · de {{ e.time_from }} a {{ e.time_to }}</template>
        </p>

        <p v-if="e.last_notified_at" class="mt-1 text-xs text-slate-400">
          Último aviso: {{ fechaHora(e.last_notified_at) }}
        </p>

        <div v-if="e.status === 'open'" class="mt-3 flex flex-wrap gap-2">
          <a
            :href="whatsappUrl(e)"
            target="_blank"
            rel="noopener"
            class="flex min-h-10 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm text-emerald-900"
          >
            Escribirle
          </a>
          <button
            type="button"
            class="min-h-10 rounded-lg px-3 text-sm text-slate-400"
            :disabled="stopping"
            @click="cerrar(e)"
          >
            Cerrar espera
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
