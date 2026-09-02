<script setup lang="ts">
import { computed, ref } from 'vue'

import { useMoney } from '@/modules/cash/composables/useMoney'
import { NxDatePicker } from '@/ui'
import { toLocalDateIso } from '@/utils/toLocalDateIso'

import { useSalesReport, type SalesFilters } from '../composables/useSalesReport'

const { money } = useMoney()

function isoDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return toLocalDateIso(date)
}

const today = isoDaysAgo(0)

const filters = ref<SalesFilters>({
  from: today,
  to: today,
  resourceId: null,
  paymentMethodId: null,
  // Sin sede: todas las que esta persona pueda ver. Un reporte no se cuadra
  // contra un cajón, así que acá "todas" sí es una respuesta legítima -- y es
  // la que el dueño de dos locales quiere por defecto.
  locationId: null,
})

const { data, isFetching } = useSalesReport(filters)

/** Atajos, porque "hoy", "esta semana" y "este mes" son el 90% de las consultas. */
const RANGES = [
  { label: 'Hoy', from: () => today, to: () => today },
  { label: 'Ayer', from: () => isoDaysAgo(1), to: () => isoDaysAgo(1) },
  { label: '7 días', from: () => isoDaysAgo(6), to: () => today },
  { label: '30 días', from: () => isoDaysAgo(29), to: () => today },
  {
    label: 'Este mes',
    from: () => today.slice(0, 8) + '01',
    to: () => today,
  },
]

const activeRange = ref('Hoy')

function applyRange(range: (typeof RANGES)[number]): void {
  activeRange.value = range.label
  filters.value = { ...filters.value, from: range.from(), to: range.to() }
}

function onManualDate(): void {
  activeRange.value = ''
}

const totals = computed(() => data.value?.totals ?? null)

/** El más alto de la serie, para escalar las barras del día a día. */
const maxDay = computed(() => Math.max(1, ...(data.value?.by_day ?? []).map((d) => d.charged)))

function percent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
</script>

<template>
  <section class="p-4 md:p-8">
    <header class="mb-4">
      <h1 class="text-xl font-semibold text-slate-800">Ventas</h1>
      <p class="mt-1 text-sm text-slate-500">
        Cuánto entró, quién lo hizo y por qué medio. Cuenta por la fecha en que se
        <b>cobró</b>, igual que la caja y la nómina.
      </p>
    </header>

    <!-- Filtros -->
    <div class="mb-5 flex flex-col gap-3">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="range in RANGES"
          :key="range.label"
          type="button"
          class="rounded-full border px-3 py-1.5 text-sm transition"
          :class="
            activeRange === range.label
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
          "
          @click="applyRange(range)"
        >
          {{ range.label }}
        </button>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NxDatePicker v-model="filters.from" label="Desde" @update:model-value="onManualDate" />
        <NxDatePicker v-model="filters.to" label="Hasta" @update:model-value="onManualDate" />

        <!-- Sólo aparece con más de una sede, y sólo con las que esta persona
             puede mirar: ofrecer una que el servidor va a rechazar es una
             trampa con forma de función. -->
        <label v-if="(data?.filters.locations ?? []).length > 1" class="text-sm text-slate-600">
          Sede
          <select
            v-model="filters.locationId"
            class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-800"
          >
            <option :value="null">Todas las sedes</option>
            <option v-for="l in data?.filters.locations ?? []" :key="l.id" :value="l.id">
              {{ l.name }}
            </option>
          </select>
        </label>

        <label class="text-sm text-slate-600">
          Quién atendió
          <select
            v-model="filters.resourceId"
            class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-800"
          >
            <option :value="null">Todo el equipo</option>
            <option v-for="r in data?.filters.resources ?? []" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
        </label>

        <label class="text-sm text-slate-600">
          Medio de pago
          <select
            v-model="filters.paymentMethodId"
            class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-800"
          >
            <option :value="null">Todos</option>
            <option v-for="m in data?.filters.payment_methods ?? []" :key="m.id" :value="m.id">
              {{ m.name }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <p v-if="isFetching && !data" class="text-sm text-slate-500">Cargando…</p>

    <template v-else-if="totals">
      <!-- Los cuatro números -->
      <div class="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <article class="rounded-lg border border-slate-200 bg-white p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">Cobrado</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-slate-800">
            {{ money(totals.charged) }}
          </p>
          <p class="text-xs text-slate-500">{{ totals.services }} servicio(s)</p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">Comisiones</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-slate-800">
            {{ money(totals.commission) }}
          </p>
          <p v-if="totals.charged > 0" class="text-xs text-slate-500">
            {{ Math.round((totals.commission / totals.charged) * 100) }}% de lo cobrado
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">Queda</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-slate-800">
            {{ money(totals.after_commission) }}
          </p>
          <!-- Se nombra así y no "ganancia" a propósito: faltan arriendo,
               insumos y nómina fija. -->
          <p class="text-xs text-slate-500">antes de gastos</p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">Ticket promedio</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-slate-800">
            {{ money(totals.average_ticket) }}
          </p>
          <p class="text-xs text-slate-500">{{ money(totals.cash) }} en efectivo</p>
        </article>
      </div>

      <!-- Por sede. Sólo con más de una: con un local, una tarjeta suelta que
           repite el total de arriba no dice nada. Va antes que "por persona"
           porque con dos locales es la primera pregunta, no la segunda. -->
      <section v-if="(data?.by_location ?? []).length > 1" class="mb-6">
        <h2 class="mb-2 text-sm font-medium text-slate-700">Por sede</h2>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="sede in data?.by_location ?? []"
            :key="sede.location_id ?? sede.name"
            class="rounded-lg border border-slate-200 bg-white p-4"
          >
            <p class="font-medium text-slate-800">{{ sede.name }}</p>
            <p class="mt-1 text-lg font-semibold tabular-nums text-slate-900">
              {{ money(sede.charged) }}
            </p>
            <p class="text-xs text-slate-500">
              {{ sede.services }} servicio(s) · {{ money(sede.commission) }} en comisiones
            </p>
          </article>
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Por persona -->
        <section>
          <h2 class="mb-2 text-sm font-medium text-slate-700">Por persona</h2>

          <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table class="w-full text-sm">
              <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th class="px-3 py-2 font-medium">Quién</th>
                  <th class="px-3 py-2 text-right font-medium">Cobró</th>
                  <th class="px-3 py-2 text-right font-medium">Comisión</th>
                  <th class="px-3 py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="row in data?.by_person ?? []" :key="row.resource_id ?? row.name">
                  <td class="px-3 py-2 text-slate-800">
                    {{ row.name }}
                    <span class="ml-1 text-xs text-slate-400">{{ row.services }}</span>
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums text-slate-800">
                    {{ money(row.charged) }}
                  </td>
                  <td class="px-3 py-2 text-right tabular-nums text-slate-600">
                    {{ money(row.commission) }}
                  </td>
                  <!-- El porcentaje real del período: con servicios a tasas
                       distintas no es ninguna de ellas. -->
                  <td class="px-3 py-2 text-right tabular-nums text-slate-500">
                    {{ percent(row.effective_rate) }}
                  </td>
                </tr>
                <tr v-if="!data?.by_person.length">
                  <td colspan="4" class="px-3 py-6 text-center text-slate-500">
                    Sin ventas en este rango.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Por medio de pago -->
        <section>
          <h2 class="mb-2 text-sm font-medium text-slate-700">Por medio de pago</h2>

          <div class="divide-y divide-slate-50 rounded-lg border border-slate-200 bg-white">
            <div
              v-for="row in data?.by_payment_method ?? []"
              :key="row.payment_method_id ?? row.name"
              class="flex items-center gap-3 px-3 py-2.5"
            >
              <span class="min-w-0 flex-1 truncate text-sm text-slate-800">
                {{ row.name }}
                <span
                  v-if="row.counts_as_cash"
                  class="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-800"
                >
                  efectivo
                </span>
              </span>
              <span class="text-xs text-slate-400">{{ row.services }}</span>
              <span class="tabular-nums text-sm text-slate-800">{{ money(row.charged) }}</span>
            </div>

            <p
              v-if="!data?.by_payment_method.length"
              class="px-3 py-6 text-center text-sm text-slate-500"
            >
              Sin ventas en este rango.
            </p>
          </div>

          <!-- Servicios más vendidos -->
          <h2 class="mb-2 mt-6 text-sm font-medium text-slate-700">Servicios más vendidos</h2>

          <div class="divide-y divide-slate-50 rounded-lg border border-slate-200 bg-white">
            <div
              v-for="row in (data?.by_service ?? []).slice(0, 8)"
              :key="row.service_id ?? row.name"
              class="flex items-center gap-3 px-3 py-2.5"
            >
              <span class="min-w-0 flex-1 truncate text-sm text-slate-800">{{ row.name }}</span>
              <span class="text-xs text-slate-400">{{ row.services }}</span>
              <span class="tabular-nums text-sm text-slate-800">{{ money(row.charged) }}</span>
            </div>

            <p v-if="!data?.by_service.length" class="px-3 py-6 text-center text-sm text-slate-500">
              Sin ventas en este rango.
            </p>
          </div>
        </section>
      </div>

      <!-- Día a día. Sólo cuando el rango es más de un día: una sola barra no
           dice nada que los números de arriba no digan mejor. -->
      <section v-if="(data?.by_day.length ?? 0) > 1" class="mt-6">
        <h2 class="mb-2 text-sm font-medium text-slate-700">Día a día</h2>

        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <div
            v-for="row in data?.by_day ?? []"
            :key="row.date"
            class="flex items-center gap-3 py-1.5"
          >
            <span class="w-24 shrink-0 text-xs text-slate-500">{{ dayLabel(row.date) }}</span>
            <span class="h-4 min-w-0 flex-1 rounded bg-slate-100">
              <span
                class="block h-full rounded bg-indigo-400"
                :style="{ width: `${(row.charged / maxDay) * 100}%` }"
              />
            </span>
            <span class="w-24 shrink-0 text-right text-sm tabular-nums text-slate-700">
              {{ money(row.charged) }}
            </span>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>
