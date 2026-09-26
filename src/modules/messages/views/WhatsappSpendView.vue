<script setup lang="ts">
/*
 * Cuánto se gasta el salón en WhatsApp.
 *
 * La cifra es la de Meta (lo que de verdad cobra), no una estimación
 * nuestra: sabe qué mensajes se entregaron, cuáles cayeron en la ventana
 * gratis de 24 horas y en qué categoría los cobró. Llega en pesos --la
 * cuenta factura en COP-- y se muestra también en dólares aproximados.
 */
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'

import { httpClient } from '@/services/http/client'
import { NxButton } from '@/ui'

interface Categoria {
  category: string
  type: string
  volume: number
  cost: number
}

interface Gasto {
  month: string
  currency: string
  total: number
  total_usd: number | null
  usd_rate: number | null
  volume: number
  by_category: Categoria[]
  daily: { date: string; volume: number; cost: number }[]
  updated_at: string
}

function mesDe(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

const mes = ref(mesDe(new Date()))
const esEsteMes = computed(() => mes.value === mesDe(new Date()))

function mover(delta: number): void {
  const [y, m] = mes.value.split('-').map(Number)
  mes.value = mesDe(new Date(y, m - 1 + delta, 1))
}

const nombreMes = computed(() => {
  const [y, m] = mes.value.split('-').map(Number)
  const texto = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
})

const { data, isFetching, error } = useQuery({
  queryKey: computed(() => ['whatsapp-gasto', mes.value] as const),
  queryFn: async () => (await httpClient.get<Gasto>('/whatsapp/gasto', { params: { mes: mes.value } })).data,
  retry: false,
})

function pesos(valor: number, moneda = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: moneda === 'COP' ? 0 : 2,
  }).format(valor)
}

function dolares(valor: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(valor)
}

/** Lo que cada categoría de Meta es, dicho como lo ve el salón. */
const ETIQUETAS: Record<string, { titulo: string; detalle: string }> = {
  MARKETING: { titulo: 'Promociones', detalle: 'Difusiones y recordatorios de retoque' },
  UTILITY: { titulo: 'Avisos de citas', detalle: 'Confirmaciones, recordatorios, cancelaciones y resúmenes' },
  AUTHENTICATION: { titulo: 'Códigos de acceso', detalle: 'Verificaciones de ingreso' },
  SERVICE: { titulo: 'Conversaciones', detalle: 'Respuestas dentro de las 24 horas: gratis' },
}

function etiqueta(c: Categoria) {
  return ETIQUETAS[c.category] ?? { titulo: c.category, detalle: '' }
}

const dias = computed(() => (data.value?.daily ?? []).filter((d) => d.cost > 0))
const maxDia = computed(() => Math.max(1, ...dias.value.map((d) => d.cost)))

function diaCorto(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })
}
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
    <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Gasto de WhatsApp</h1>
        <p class="text-sm text-slate-500">Lo que Meta cobra por los mensajes del salón</p>
      </div>
      <div class="flex items-center justify-between gap-1 md:justify-start">
        <NxButton variant="outline" size="sm" aria-label="Mes anterior" @click="mover(-1)">
          <i class="pi pi-chevron-left text-xs" />
        </NxButton>
        <span class="min-w-32 text-center text-sm font-medium text-slate-700">{{ nombreMes }}</span>
        <NxButton variant="outline" size="sm" aria-label="Mes siguiente" :disabled="esEsteMes" @click="mover(1)">
          <i class="pi pi-chevron-right text-xs" />
        </NxButton>
      </div>
    </header>

    <p v-if="error" class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      No pudimos consultar el gasto en este momento. Intenta de nuevo en un rato.
    </p>

    <template v-else-if="data">
      <div class="rounded-xl border border-slate-200 bg-white p-5">
        <p class="text-sm text-slate-500">{{ esEsteMes ? 'En lo que va del mes' : 'Total del mes' }}</p>
        <p class="mt-1 text-3xl font-semibold text-slate-900">{{ pesos(data.total, data.currency) }}</p>
        <p v-if="data.total_usd !== null && data.currency !== 'USD'" class="mt-1 text-sm text-slate-500">
          ≈ {{ dolares(data.total_usd) }}
          <span v-if="data.usd_rate" class="text-slate-400">(a {{ pesos(data.usd_rate) }} por dólar)</span>
        </p>
        <p class="mt-2 text-xs text-slate-400">{{ data.volume }} mensajes en total</p>
      </div>

      <div class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        <div v-for="c in data.by_category" :key="c.category + c.type" class="flex items-center justify-between gap-3 p-4">
          <div class="min-w-0">
            <p class="font-medium text-slate-800">{{ etiqueta(c).titulo }}</p>
            <p class="text-xs text-slate-500">{{ etiqueta(c).detalle }} · {{ c.volume }} mensajes</p>
          </div>
          <div class="shrink-0 text-right">
            <p class="font-semibold text-slate-800">{{ c.cost > 0 ? pesos(c.cost, data.currency) : 'Gratis' }}</p>
            <p v-if="c.cost > 0 && c.volume" class="text-xs text-slate-400">
              {{ pesos(c.cost / c.volume, data.currency) }} c/u
            </p>
          </div>
        </div>
        <p v-if="!data.by_category.length" class="p-4 text-sm text-slate-500">Sin mensajes este mes.</p>
      </div>

      <div v-if="dias.length" class="rounded-xl border border-slate-200 bg-white p-4">
        <p class="mb-3 text-sm font-medium text-slate-700">Por día</p>
        <div class="space-y-2">
          <div v-for="d in dias" :key="d.date" class="flex items-center gap-3 text-sm">
            <span class="w-16 shrink-0 text-slate-500">{{ diaCorto(d.date) }}</span>
            <div class="h-2 flex-1 rounded-full bg-slate-100">
              <div class="h-2 rounded-full bg-indigo-500" :style="{ width: `${(d.cost / maxDia) * 100}%` }" />
            </div>
            <span class="w-24 shrink-0 text-right text-slate-700">{{ pesos(d.cost, data.currency) }}</span>
          </div>
        </div>
      </div>

      <p class="text-xs text-slate-400">
        Datos de Meta. Pueden tardar unas horas en aparecer y se actualizan cada hora.
      </p>
    </template>

    <p v-else-if="isFetching" class="text-sm text-slate-500">Consultando a Meta…</p>
  </section>
</template>
