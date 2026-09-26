<script setup lang="ts">
/*
 * Mis vales: los adelantos, insumos y demás que se le descuentan en la nómina.
 *
 * Arriba lo que falta por descontar -- lo que se le va a restar en el próximo
 * pago --, que es la sorpresa más común del día de pago. Debajo, los de los
 * últimos tres meses que ya entraron en un pago.
 */
import { computed } from 'vue'

import { useAuthStore } from '@/stores/auth.store'

import { useMoney } from '@/modules/cash/composables/useMoney'

import { useMyWork } from '../composables/useMyWork'
import { diaLegible } from '../support/fechas'

const auth = useAuthStore()
const { money } = useMoney()
const { data, isLoading } = useMyWork()

const vales = computed(() => data.value?.adjustments ?? [])
const pendientes = computed(() => vales.value.filter((v) => v.pending))
const descontados = computed(() => vales.value.filter((v) => !v.pending))

/** Lo que se le va a restar en el próximo pago (los premios suman). */
const porDescontar = computed(() =>
  pendientes.value.reduce((sum, v) => sum + (v.kind === 'bonus' ? -v.amount : v.amount), 0),
)
</script>

<template>
  <section class="p-4 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Mis vales</h1>
      <p class="mt-1 text-sm text-slate-500">
        {{ data?.resource?.name ?? auth.user?.full_name }}
      </p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p v-else-if="!data?.resource" class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600">
      {{ data?.message ?? 'Tu usuario no está asociado a nadie de la agenda.' }}
    </p>

    <template v-else>
      <article class="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p class="text-xs uppercase tracking-wide text-amber-700">
          Se descuenta en tu próximo pago
        </p>
        <p class="mt-1 text-3xl font-semibold tabular-nums text-amber-900">
          {{ money(Math.max(0, porDescontar)) }}
        </p>
        <p class="text-xs text-amber-800">
          {{
            pendientes.length
              ? `${pendientes.length} vale(s) sin descontar`
              : 'No tienes vales pendientes.'
          }}
        </p>
      </article>

      <template v-if="pendientes.length">
        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">Pendientes</h2>
        <div class="mb-8 flex flex-col gap-2">
          <article
            v-for="v in pendientes"
            :key="v.id"
            class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div class="min-w-0">
              <p class="font-medium text-slate-800">{{ v.label }}</p>
              <p class="truncate text-xs text-slate-500">
                {{ diaLegible(v.date)
                }}<template v-if="v.description"> · {{ v.description }}</template>
              </p>
            </div>
            <span
              class="shrink-0 font-semibold tabular-nums"
              :class="v.kind === 'bonus' ? 'text-emerald-700' : 'text-slate-800'"
            >
              {{ v.kind === 'bonus' ? '+' : '−' }}{{ money(v.amount) }}
            </span>
          </article>
        </div>
      </template>

      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
        Ya descontados
        <span class="normal-case tracking-normal text-slate-400">· últimos 3 meses</span>
      </h2>
      <p v-if="!descontados.length" class="text-sm text-slate-500">Nada en los últimos 3 meses.</p>
      <div v-else class="flex flex-col gap-2">
        <article
          v-for="v in descontados"
          :key="v.id"
          class="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-4 py-3 text-slate-600"
        >
          <div class="min-w-0">
            <p class="text-sm">{{ v.label }}</p>
            <p class="truncate text-xs text-slate-400">
              {{ diaLegible(v.date)
              }}<template v-if="v.description"> · {{ v.description }}</template>
            </p>
          </div>
          <span class="shrink-0 text-sm tabular-nums">
            {{ v.kind === 'bonus' ? '+' : '−' }}{{ money(v.amount) }}
          </span>
        </article>
      </div>
    </template>
  </section>
</template>
