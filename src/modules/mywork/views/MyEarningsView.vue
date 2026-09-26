<script setup lang="ts">
/*
 * Mis ganancias: cuánto lleva desde el último pago, la semana, el mes, y lo
 * que ya le pagaron.
 *
 * Aparte de Mi día a propósito: Mi día es para trabajar (las citas de hoy,
 * lo que falta cobrar); esto es para la pregunta del viernes -- «¿cuánto me
 * van a pagar?» y «¿cuánto me pagaron el mes pasado?».
 */
import { useAuthStore } from '@/stores/auth.store'

import { useMoney } from '@/modules/cash/composables/useMoney'

import { useMyWork } from '../composables/useMyWork'
import { diaLegible, periodo } from '../support/fechas'

const auth = useAuthStore()
const { money } = useMoney()
const { data, isLoading } = useMyWork()
</script>

<template>
  <section class="p-4 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Mis ganancias</h1>
      <p class="mt-1 text-sm text-slate-500">
        {{ data?.resource?.name ?? auth.user?.full_name }}
      </p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p v-else-if="!data?.resource" class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600">
      {{ data?.message ?? 'Tu usuario no está asociado a nadie de la agenda.' }}
    </p>

    <template v-else>
      <!-- La MISMA cifra que ve quien paga: si esta pantalla sacara su propia
           cuenta, un día diría una cosa y la liquidación otra. -->
      <article
        v-if="data.to_date"
        class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4"
      >
        <p class="text-xs uppercase tracking-wide text-emerald-700">
          Llevas desde tu último pago
          <span class="normal-case tracking-normal text-emerald-600">
            · desde el {{ diaLegible(data.to_date.since) }}
          </span>
        </p>
        <p class="mt-1 text-3xl font-semibold tabular-nums text-emerald-900">
          {{ money(data.to_date.net) }}
        </p>
        <dl class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-emerald-800">
          <div>
            <dt class="inline">Comisión:</dt>
            <dd class="inline tabular-nums">{{ money(data.to_date.commission) }}</dd>
          </div>
          <div v-if="data.to_date.bonus">
            <dt class="inline">Premios:</dt>
            <dd class="inline tabular-nums">+{{ money(data.to_date.bonus) }}</dd>
          </div>
          <div v-if="data.to_date.deduction">
            <dt class="inline">Vales y descuentos:</dt>
            <dd class="inline tabular-nums">−{{ money(data.to_date.deduction) }}</dd>
          </div>
          <div>
            <dt class="inline">Servicios:</dt>
            <dd class="inline tabular-nums">
              {{ data.to_date.services }} · {{ money(data.to_date.charged) }} vendido
            </dd>
          </div>
        </dl>
      </article>

      <div class="mb-8 grid gap-3 sm:grid-cols-3">
        <article
          v-for="(bloque, titulo) in {
            Hoy: data.today,
            'Esta semana': data.week,
            'Este mes': data.month,
          }"
          :key="titulo"
          class="rounded-lg border border-slate-200 bg-white p-4"
        >
          <p class="text-xs uppercase tracking-wide text-slate-400">{{ titulo }}</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-slate-800">
            {{ money(bloque.commission) }}
          </p>
          <p class="text-xs text-slate-500">
            {{ bloque.services }} servicio(s) · {{ money(bloque.charged) }} vendido
          </p>
        </article>
      </div>

      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
        Lo que ya te pagaron
      </h2>

      <p v-if="!data.payments.length" class="text-sm text-slate-500">Todavía no hay pagos.</p>

      <div v-else class="flex flex-col gap-2">
        <article
          v-for="pago in data.payments"
          :key="pago.id"
          class="rounded-lg border border-slate-200 bg-white px-4 py-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="font-medium text-slate-800">
                {{ periodo(pago.period_start, pago.period_end) }}
              </p>
              <p class="text-xs text-slate-500">
                Pagado el {{ diaLegible(pago.paid_at) }} · {{ pago.services_count }} servicio(s)
              </p>
            </div>
            <span class="text-lg font-semibold tabular-nums text-slate-800">
              {{ money(pago.net_total) }}
            </span>
          </div>

          <!-- El desglose, no sólo el neto: el descuento que no se entiende
               es el que termina en una discusión el día de pago. -->
          <dl class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <div v-if="pago.commission_total">
              <dt class="inline">Comisión:</dt>
              <dd class="inline tabular-nums">{{ money(pago.commission_total) }}</dd>
            </div>
            <div v-if="pago.base_total">
              <dt class="inline">Base:</dt>
              <dd class="inline tabular-nums">{{ money(pago.base_total) }}</dd>
            </div>
            <div v-if="pago.bonus_total">
              <dt class="inline">Premios:</dt>
              <dd class="inline tabular-nums text-emerald-700">+{{ money(pago.bonus_total) }}</dd>
            </div>
            <div v-if="pago.deduction_total">
              <dt class="inline">Vales y descuentos:</dt>
              <dd class="inline tabular-nums text-red-700">−{{ money(pago.deduction_total) }}</dd>
            </div>
          </dl>

          <p v-if="pago.notes" class="mt-1 text-xs text-slate-500">{{ pago.notes }}</p>
        </article>
      </div>
    </template>
  </section>
</template>
