<script setup lang="ts">
import { ref } from 'vue'

import { useAuthStore } from '@/stores/auth.store'
import { NxDatePicker } from '@/ui'

import LocationPicker from '@/modules/settings/components/LocationPicker.vue'
import { toLocalDateIso } from '@/utils/toLocalDateIso'

import { useDailySummary } from '../composables/useCash'
import { useMoney } from '../composables/useMoney'

const auth = useAuthStore()
const { money } = useMoney()

const date = ref(toLocalDateIso())

/*
 * Sin `requerido`: el resumen no se cuadra contra un cajón, responde "cómo nos
 * fue hoy". Para el dueño de dos locales esa pregunta es de los dos, así que
 * "todas" es el default correcto -- al revés que en el cierre.
 */
const locationId = ref<number | null>(null)

const { data, isLoading } = useDailySummary(date, locationId)
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Resumen del día</h1>
        <p class="mt-1 text-sm text-slate-500">{{ auth.business?.name }}</p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <LocationPicker v-model="locationId" label="Sede" />
        <div class="w-44">
          <NxDatePicker v-model="date" label="Día" />
        </div>
      </div>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <template v-else-if="data">
      <!-- Lo que falta cobrar va arriba y en ámbar: es la acción pendiente
           más común al cerrar la jornada, no un dato más. -->
      <div
        v-if="data.appointments.pending_checkout > 0"
        class="mb-6 rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <p class="font-medium">{{ data.appointments.pending_checkout }} cita(s) sin cobrar</p>
        <p class="mt-0.5">
          <RouterLink :to="{ name: 'agenda' }" class="underline">Ir a la agenda</RouterLink>
        </p>
      </div>

      <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Entró</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ money(data.totals.total_charged) }}
          </p>
          <p class="text-xs text-slate-500">{{ data.totals.appointments }} cita(s) cobrada(s)</p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">En comisiones</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ money(data.totals.total_commissions) }}
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Gastos</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ money(data.totals.total_expenses) }}
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Citas</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ data.appointments.total }}
          </p>
          <p class="text-xs text-slate-500">
            {{ data.appointments.completed }} atendidas
            <span v-if="data.appointments.no_show" class="text-red-600">
              · {{ data.appointments.no_show }} no asistió
            </span>
            <span v-if="data.appointments.cancelled" class="text-slate-400">
              · {{ data.appointments.cancelled }} canceladas
            </span>
          </p>
        </article>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-700">Por persona</h2>

          <p v-if="!data.by_resource.length" class="text-sm text-slate-500">Sin citas este día.</p>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th class="pb-2 font-medium">Quién</th>
                  <th class="pb-2 text-right font-medium">Citas</th>
                  <th class="pb-2 text-right font-medium">Cobrado</th>
                  <th class="pb-2 text-right font-medium">Comisión</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="row in data.by_resource" :key="row.name">
                  <td class="py-2 text-slate-800">{{ row.name }}</td>
                  <td class="py-2 text-right tabular-nums text-slate-600">
                    {{ row.appointments }}
                  </td>
                  <td class="py-2 text-right tabular-nums text-slate-600">
                    {{ money(row.charged) }}
                  </td>
                  <td class="py-2 text-right tabular-nums font-medium text-slate-800">
                    {{ money(row.commission) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-700">Cómo entró</h2>

          <p v-if="!data.totals.payment_breakdown.length" class="text-sm text-slate-500">
            Sin cobros este día.
          </p>

          <p
            v-for="row in data.totals.payment_breakdown"
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

          <p class="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
            <span class="font-medium text-slate-700">Debe haber en caja</span>
            <span class="font-semibold tabular-nums text-slate-900">
              {{ money(data.totals.expected_cash) }}
            </span>
          </p>
        </article>
      </div>
    </template>
  </section>
</template>
