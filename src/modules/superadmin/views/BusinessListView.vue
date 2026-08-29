<script setup lang="ts">
import { ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { NxButton, NxInput } from '@/ui'

import CreateBusinessModal from '../components/CreateBusinessModal.vue'
import {
  usePlatformBusinesses,
  useToggleBusiness,
  PLAN_LABELS,
  VERTICAL_LABELS,
  type PlatformBusiness,
} from '../composables/usePlatform'

const { notify } = useSystemAlert()

const term = ref('')
const creating = ref(false)

const { data: businesses, isLoading } = usePlatformBusinesses(term)
const { mutateAsync: toggle } = useToggleBusiness()

async function onToggle(business: PlatformBusiness): Promise<void> {
  const suspending = business.is_active

  if (
    suspending &&
    !window.confirm(
      `¿Suspender "${business.name}"? Nadie de ese negocio podrá entrar. Sus datos y su agenda quedan intactos.`,
    )
  ) {
    return
  }

  await toggle(business.id)
  notify(suspending ? 'Negocio suspendido.' : 'Negocio reactivado.', 'success')
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Negocios</h1>
        <p class="mt-1 text-sm text-slate-500">Spas y barberías en la plataforma.</p>
      </div>
      <NxButton @click="creating = true">Nuevo negocio</NxButton>
    </header>

    <div class="mb-4 w-72">
      <NxInput v-model="term" placeholder="Buscar por nombre" icon="pi pi-search" clearable />
    </div>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p v-else-if="!businesses?.length" class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600">
      No hay negocios que coincidan.
    </p>

    <div v-else class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table class="w-full min-w-[46rem] text-sm">
        <thead class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th class="px-4 py-3 font-medium">Negocio</th>
            <th class="px-4 py-3 font-medium">Plan</th>
            <th class="px-4 py-3 text-right font-medium">Equipo</th>
            <th class="px-4 py-3 text-right font-medium">Servicios</th>
            <th class="px-4 py-3 text-right font-medium">Citas 30d</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr v-for="business in businesses" :key="business.id" :class="{ 'opacity-50': !business.is_active }">
            <td class="px-4 py-3">
              <RouterLink
                :to="{ name: 'sa-business', params: { id: business.id } }"
                class="font-medium text-slate-800 hover:underline"
              >
                {{ business.name }}
              </RouterLink>
              <p class="text-xs text-slate-500">
                {{ VERTICAL_LABELS[business.vertical] ?? business.vertical }} · {{ business.timezone }}
                <span v-if="!business.is_active" class="text-red-600"> · suspendido</span>
              </p>
            </td>
            <td class="px-4 py-3 text-slate-600">
              {{ business.subscription_plan ? (PLAN_LABELS[business.subscription_plan] ?? business.subscription_plan) : '—' }}
            </td>
            <td class="px-4 py-3 text-right tabular-nums text-slate-600">{{ business.counts.resources }}</td>
            <td class="px-4 py-3 text-right tabular-nums text-slate-600">{{ business.counts.services }}</td>
            <td class="px-4 py-3 text-right tabular-nums text-slate-600">
              {{ business.counts.appointments_30d }}
            </td>
            <td class="px-4 py-3 text-right">
              <NxButton variant="ghost" size="sm" @click="onToggle(business)">
                {{ business.is_active ? 'Suspender' : 'Reactivar' }}
              </NxButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <CreateBusinessModal
      :open="creating"
      @close="creating = false"
      @created="creating = false; notify('Negocio creado.', 'success')"
    />
  </section>
</template>
