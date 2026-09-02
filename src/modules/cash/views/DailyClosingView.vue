<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxDatePicker, NxInput } from '@/ui'

import LocationPicker from '@/modules/settings/components/LocationPicker.vue'
import { toLocalDateIso } from '@/utils/toLocalDateIso'

import { useCloseDay, useClosingPreview, useClosings, useUndoClosing } from '../composables/useCash'
import { useMoney } from '../composables/useMoney'

const { notify } = useSystemAlert()
const { money, signed } = useMoney()

const date = ref(toLocalDateIso())

/*
 * En qué sede se está cerrando.
 *
 * Va `requerido`: un cierre se cuadra contra UN cajón. "Todas las sedes" no es
 * una opción acá -- un cuadre que abarque dos no se puede confirmar contra
 * ninguno -- así que el selector arranca en la principal en vez de en vacío.
 * Con un solo local ni se muestra, y todo se comporta como antes.
 */
const locationId = ref<number | null>(null)
const actualCash = ref('')
const note = ref('')
const error = ref<string | null>(null)

const { data: preview, isLoading } = useClosingPreview(date, locationId)
const { data: closings } = useClosings(locationId)
const { mutateAsync: closeDay, isPending: closingDay } = useCloseDay()
const { mutateAsync: undo } = useUndoClosing()

const difference = computed(() => {
  if (!preview.value || actualCash.value === '') {
    return null
  }

  return Number(actualCash.value) - preview.value.expected_cash
})

async function close(): Promise<void> {
  error.value = null

  try {
    const closed = await closeDay({
      date: date.value,
      actual_cash: Number(actualCash.value || 0),
      note: note.value || undefined,
      location_id: locationId.value,
    })

    actualCash.value = ''
    note.value = ''

    notify(
      closed.difference === 0
        ? 'Día cerrado y cuadrado.'
        : `Día cerrado con una diferencia de ${signed(closed.difference)}.`,
      closed.difference === 0 ? 'success' : 'warn',
    )
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos cerrar el día.')
  }
}

async function undoClosing(id: number, day: string): Promise<void> {
  if (!window.confirm(`¿Deshacer el cierre del ${day}? La base del día siguiente cambia.`)) {
    return
  }

  try {
    await undo(id)
    notify('Cierre deshecho.', 'success')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos deshacer el cierre.'), 'error')
  }
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Cierre del día</h1>
        <p class="mt-1 text-sm text-slate-500">Todo el negocio, no solo tu turno.</p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <!-- Cada local cuadra su propio cajón: acá no existe "todas". -->
        <LocationPicker v-model="locationId" requerido label="Sede" />
        <div class="w-44">
          <NxDatePicker v-model="date" label="Día" />
        </div>
      </div>
    </header>

    <!-- Días con movimiento que quedaron sin cerrar. Solo aparecen los que
         tuvieron citas: una lista con los días que el spa no abrió no la
         mira nadie. -->
    <div
      v-if="preview?.pending_dates.length"
      class="mb-6 rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p class="font-medium">Días sin cerrar</p>
      <p class="mt-1">
        <button
          v-for="day in preview.pending_dates"
          :key="day"
          type="button"
          class="mr-2 underline"
          @click="date = day"
        >
          {{ day }}
        </button>
      </p>
    </div>

    <p v-if="isLoading" class="text-sm text-slate-500">Calculando…</p>

    <template v-else-if="preview">
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article class="rounded-lg border border-slate-200 bg-white p-3">
              <p class="text-xs uppercase tracking-wide text-slate-400">Cobrado</p>
              <p class="mt-1 text-lg font-semibold tabular-nums text-slate-800">
                {{ money(preview.total_charged) }}
              </p>
              <p class="text-xs text-slate-500">{{ preview.appointments }} cita(s)</p>
            </article>

            <article class="rounded-lg border border-slate-200 bg-white p-3">
              <p class="text-xs uppercase tracking-wide text-slate-400">Comisiones</p>
              <p class="mt-1 text-lg font-semibold tabular-nums text-slate-800">
                {{ money(preview.total_commissions) }}
              </p>
            </article>

            <article class="rounded-lg border border-slate-200 bg-white p-3">
              <p class="text-xs uppercase tracking-wide text-slate-400">Gastos</p>
              <p class="mt-1 text-lg font-semibold tabular-nums text-slate-800">
                {{ money(preview.total_expenses) }}
              </p>
              <!-- Lo que salió del cajón puede ser más que el gasto del día:
                   la nómina y el arriendo no son gasto de operar el martes,
                   pero si se pagaron en efectivo esos billetes no están. Sin
                   esta línea, quien cuenta ve "gastos $0" y un esperado más
                   bajo, y no entiende de dónde sale la resta. -->
              <p v-if="preview.cash_out > preview.total_expenses" class="text-xs text-amber-700">
                salió de caja {{ money(preview.cash_out) }}
              </p>
            </article>

            <article class="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p class="text-xs uppercase tracking-wide text-indigo-500">Debe haber</p>
              <p class="mt-1 text-lg font-semibold tabular-nums text-indigo-900">
                {{ money(preview.expected_cash) }}
              </p>
              <p class="text-xs text-indigo-700">base {{ money(preview.opening_cash) }}</p>
            </article>
          </div>

          <article class="rounded-lg border border-slate-200 bg-white p-4">
            <h2 class="mb-3 text-sm font-medium text-slate-700">Cómo entró</h2>

            <p v-if="!preview.payment_breakdown.length" class="text-sm text-slate-500">
              Sin movimiento este día.
            </p>

            <p
              v-for="row in preview.payment_breakdown"
              :key="row.label"
              class="flex items-center justify-between border-b border-slate-50 py-1.5 text-sm last:border-0"
            >
              <span class="text-slate-700">
                {{ row.label }}
                <span v-if="!row.counts_as_cash" class="ml-1 text-xs text-slate-400"
                  >no es efectivo</span
                >
              </span>
              <span class="tabular-nums text-slate-800">{{ money(row.total) }}</span>
            </p>
          </article>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-5">
          <template v-if="preview.already_closed">
            <h2 class="mb-1 font-medium text-slate-800">Ya cerrado</h2>
            <p class="text-sm text-slate-500">
              Este día ya fue cerrado. Mira el historial abajo si necesitas deshacerlo.
            </p>
          </template>

          <template v-else>
            <h2 class="mb-1 font-medium text-slate-800">Cerrar el día</h2>
            <p class="mb-4 text-sm text-slate-500">Cuenta el efectivo que queda en la caja.</p>

            <div class="flex flex-col gap-3">
              <NxInput
                v-model="actualCash"
                label="Efectivo contado"
                inputmode="numeric"
                :disabled="closingDay"
              />

              <div
                v-if="difference !== null"
                class="rounded-md px-3 py-2 text-sm"
                :class="
                  difference === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
                "
              >
                <span v-if="difference === 0">Cuadra exacto.</span>
                <span v-else
                  >{{ difference > 0 ? 'Sobra' : 'Falta' }} {{ money(Math.abs(difference)) }}.</span
                >
              </div>

              <p class="text-xs text-slate-500">
                Lo contado queda como base de mañana, no lo esperado.
              </p>

              <NxInput v-model="note" label="Nota (opcional)" :disabled="closingDay" />

              <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {{ error }}
              </p>

              <NxButton :loading="closingDay" :disabled="actualCash === ''" @click="close">
                Cerrar día
              </NxButton>
            </div>
          </template>
        </div>
      </div>

      <h2 class="mb-3 mt-8 text-sm font-medium uppercase tracking-wide text-slate-400">
        Cierres anteriores
      </h2>

      <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table class="w-full min-w-[42rem] text-sm">
          <thead
            class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400"
          >
            <tr>
              <th class="px-4 py-3 font-medium">Día</th>
              <th class="px-4 py-3 text-right font-medium">Cobrado</th>
              <th class="px-4 py-3 text-right font-medium">Esperado</th>
              <th class="px-4 py-3 text-right font-medium">Contado</th>
              <th class="px-4 py-3 text-right font-medium">Diferencia</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-100">
            <tr v-if="!closings?.length">
              <td colspan="6" class="px-4 py-6 text-center text-slate-500">Sin cierres todavía.</td>
            </tr>

            <tr v-for="closing in closings ?? []" :key="closing.id">
              <td class="px-4 py-3 tabular-nums text-slate-800">{{ closing.date }}</td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-600">
                {{ money(closing.total_charged) }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-600">
                {{ money(closing.expected_cash) }}
              </td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-600">
                {{ money(closing.actual_cash) }}
              </td>
              <td
                class="px-4 py-3 text-right tabular-nums"
                :class="closing.difference === 0 ? 'text-slate-400' : 'font-medium text-amber-700'"
              >
                {{ closing.difference === 0 ? '—' : signed(closing.difference) }}
              </td>
              <td class="px-4 py-3 text-right">
                <NxButton variant="ghost" size="sm" @click="undoClosing(closing.id, closing.date)">
                  Deshacer
                </NxButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
