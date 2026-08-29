<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput } from '@/ui'

import { useCloseShift, useOpenShift, useShift } from '../composables/useCash'
import { useMoney } from '../composables/useMoney'

const { notify } = useSystemAlert()
const { money, signed } = useMoney()

const { data, isLoading } = useShift()
const { mutateAsync: openShift, isPending: opening } = useOpenShift()
const { mutateAsync: closeShift, isPending: closing } = useCloseShift()

const openingCash = ref('')
const countedCash = ref('')
const note = ref('')
const error = ref<string | null>(null)

const shift = computed(() => data.value?.shift ?? null)
const totals = computed(() => data.value?.totals ?? null)

/** Lo que sobra o falta si se cerrara con lo que está escrito. */
const preview = computed(() => {
  if (!totals.value || countedCash.value === '') {
    return null
  }

  return Number(countedCash.value) - totals.value.expected_cash
})

async function open(): Promise<void> {
  error.value = null

  try {
    await openShift({ opening_cash: Number(openingCash.value || 0), note: note.value || undefined })
    openingCash.value = ''
    note.value = ''
    notify('Turno abierto.', 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos abrir el turno.')
  }
}

async function close(): Promise<void> {
  error.value = null

  try {
    const closed = await closeShift({
      counted_cash: Number(countedCash.value || 0),
      note: note.value || undefined,
    })
    countedCash.value = ''
    note.value = ''

    const diff = closed.difference ?? 0
    notify(
      diff === 0
        ? 'Turno cerrado y cuadrado.'
        : `Turno cerrado con una diferencia de ${signed(diff)}.`,
      diff === 0 ? 'success' : 'warn',
    )
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos cerrar el turno.')
  }
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Mi turno</h1>
      <p class="mt-1 text-sm text-slate-500">
        El efectivo del que respondes tú, distinto del cierre del negocio.
      </p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <!-- Sin turno abierto -->
    <div v-else-if="!shift" class="max-w-md rounded-lg border border-slate-200 bg-white p-5">
      <h2 class="mb-1 font-medium text-slate-800">Abrir turno</h2>
      <p class="mb-4 text-sm text-slate-500">
        Cuenta el efectivo con el que arrancas. Es contra lo que se compara al cerrar.
      </p>

      <div class="flex flex-col gap-3">
        <NxInput v-model="openingCash" label="Base inicial" inputmode="numeric" :disabled="opening" />
        <NxInput v-model="note" label="Nota (opcional)" :disabled="opening" />

        <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <NxButton class="self-start" :loading="opening" @click="open">Abrir turno</NxButton>
      </div>
    </div>

    <!-- Turno abierto -->
    <div v-else class="grid gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs uppercase tracking-wide text-slate-400">Base</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-slate-800">
              {{ money(shift.opening_cash) }}
            </p>
          </article>

          <article class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs uppercase tracking-wide text-slate-400">Cobrado</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-slate-800">
              {{ money(totals?.total_charged) }}
            </p>
            <p class="text-xs text-slate-500">{{ totals?.appointments ?? 0 }} cita(s)</p>
          </article>

          <article class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs uppercase tracking-wide text-slate-400">Gastos</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-slate-800">
              {{ money(totals?.total_expenses) }}
            </p>
          </article>

          <article class="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <p class="text-xs uppercase tracking-wide text-indigo-500">Debe haber</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-indigo-900">
              {{ money(totals?.expected_cash) }}
            </p>
            <p class="text-xs text-indigo-700">en efectivo</p>
          </article>
        </div>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-700">Cómo entró</h2>

          <p v-if="!totals?.payment_breakdown.length" class="text-sm text-slate-500">
            Todavía no has cobrado nada en este turno.
          </p>

          <p
            v-for="row in totals?.payment_breakdown ?? []"
            :key="row.label"
            class="flex items-center justify-between border-b border-slate-50 py-1.5 text-sm last:border-0"
          >
            <span class="text-slate-700">
              {{ row.label }}
              <!-- Lo que no entra al cajón se marca: es la causa más común de
                   creer que falta plata cuando no falta. -->
              <span v-if="!row.counts_as_cash" class="ml-1 text-xs text-slate-400">no es efectivo</span>
            </span>
            <span class="tabular-nums text-slate-800">{{ money(row.total) }}</span>
          </p>
        </article>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-5">
        <h2 class="mb-1 font-medium text-slate-800">Cerrar turno</h2>
        <p class="mb-4 text-sm text-slate-500">Cuenta el efectivo que hay en el cajón ahora.</p>

        <div class="flex flex-col gap-3">
          <NxInput v-model="countedCash" label="Efectivo contado" inputmode="numeric" :disabled="closing" />

          <div
            v-if="preview !== null"
            class="rounded-md px-3 py-2 text-sm"
            :class="preview === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'"
          >
            <span v-if="preview === 0">Cuadra exacto.</span>
            <span v-else>
              {{ preview > 0 ? 'Sobra' : 'Falta' }} {{ money(Math.abs(preview)) }}.
            </span>
          </div>

          <NxInput v-model="note" label="Nota (opcional)" :disabled="closing" />

          <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

          <NxButton :loading="closing" :disabled="countedCash === ''" @click="close">
            Cerrar turno
          </NxButton>
        </div>
      </div>
    </div>
  </section>
</template>
