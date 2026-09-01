<script setup lang="ts">
import { ref } from 'vue'

import { useAuthStore } from '@/stores/auth.store'
import { NxInput } from '@/ui'

import { useClientList } from '../composables/useClients'

const auth = useAuthStore()
const term = ref('')

const { data, isLoading } = useClientList(term)
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
            <th class="px-4 py-3 text-right font-medium">Visitas</th>
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
            <td class="px-4 py-3 text-right tabular-nums text-slate-600">{{ client.visits }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
