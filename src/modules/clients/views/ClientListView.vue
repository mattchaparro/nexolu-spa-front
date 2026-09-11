<script setup lang="ts">
import { ref } from 'vue'

import { useAuthStore } from '@/stores/auth.store'
import { NxInput } from '@/ui'

import { useClientList } from '../composables/useClients'

const auth = useAuthStore()
const term = ref('')

const { data, isLoading } = useClientList(term)

/*
 * "Hace 3 días", no una fecha.
 *
 * Quien mira esta lista está decidiendo a quién llamar: "hace 3 días" se
 * responde solo, y "2026-09-08" hay que restarlo mentalmente.
 */
function hace(dias: number | null): string {
  if (dias === null) return '—'
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  if (dias < 365) return `hace ${Math.round(dias / 30)} meses`

  return 'hace más de un año'
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Clientes</h1>
      <p class="mt-1 text-sm text-slate-500">
        {{ data?.meta.total ?? 0 }} en {{ auth.business?.name }}
      </p>
    </header>

    <div class="mb-4 w-80">
      <NxInput
        v-model="term"
        placeholder="Buscar por nombre o teléfono"
        icon="pi pi-search"
        clearable
      />
    </div>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p
      v-else-if="!data?.data.length"
      class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600"
    >
      {{ term ? 'Ningún cliente coincide.' : 'Todavía no hay clientes. Se crean al agendar.' }}
    </p>

    <div v-else class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table class="w-full min-w-[34rem] text-sm">
        <thead
          class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400"
        >
          <tr>
            <th class="px-4 py-3 font-medium">Cliente</th>
            <th class="px-4 py-3 font-medium">Teléfono</th>
            <th class="px-4 py-3 font-medium">Cómo va</th>
            <th class="px-4 py-3 text-right font-medium">Visitas</th>
            <th class="px-4 py-3 text-right font-medium">Última</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr v-for="client in data.data" :key="client.id" class="hover:bg-slate-50">
            <td class="px-4 py-3">
              <RouterLink
                :to="{ name: 'client', params: { id: client.id } }"
                class="font-medium text-slate-800 hover:underline"
              >
                {{ client.full_name }}
              </RouterLink>
              <span v-if="!client.is_active" class="ml-2 text-xs text-slate-400">inactivo</span>
            </td>
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ client.phone ?? '—' }}</td>

            <!-- La etiqueta, calculada de sus visitas. Frecuente en verde
                 porque es la que hay que cuidar; "sin visitas" en gris para
                 que no compita: hoy son 357 de 759 y teñirlas de rojo pintaría
                 media pantalla de alarma por algo que no es culpa de nadie. -->
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="{
                  'bg-emerald-100 text-emerald-800': client.segment === 'frecuente',
                  'bg-indigo-100 text-indigo-800': client.segment === 'ocasional',
                  'bg-amber-100 text-amber-800': client.segment === 'nueva',
                  'bg-slate-100 text-slate-500': client.segment === 'sin_visitas',
                }"
              >
                {{ client.segment_label }}
              </span>
            </td>

            <td class="px-4 py-3 text-right tabular-nums text-slate-600">{{ client.visits }}</td>

            <td class="px-4 py-3 text-right text-sm text-slate-500">
              {{ hace(client.days_since_visit) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
