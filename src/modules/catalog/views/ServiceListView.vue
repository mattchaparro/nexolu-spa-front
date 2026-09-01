<script setup lang="ts">
import { ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useAuthStore } from '@/stores/auth.store'
import { NxButton } from '@/ui'

import ServiceFormModal from '../components/ServiceFormModal.vue'
import {
  useAdminServices,
  useDeactivateService,
  type AdminService,
} from '../composables/useCatalog'

const auth = useAuthStore()
const { notify } = useSystemAlert()

const { data: services, isLoading } = useAdminServices()
const { mutateAsync: deactivate } = useDeactivateService()

const editing = ref<AdminService | null>(null)
const open = ref(false)

function create(): void {
  editing.value = null
  open.value = true
}

function edit(service: AdminService): void {
  editing.value = service
  open.value = true
}

function onSaved(): void {
  open.value = false
  notify('Servicio guardado.', 'success')
}

async function remove(service: AdminService): Promise<void> {
  if (
    !window.confirm(
      `¿Desactivar "${service.name}"? Dejará de ofrecerse, pero se conserva su historial.`,
    )
  ) {
    return
  }

  await deactivate(service.id)
  notify('Servicio desactivado.', 'success')
}

function money(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: auth.business?.currency ?? 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Servicios</h1>
        <p class="mt-1 text-sm text-slate-500">Lo que ofrece {{ auth.business?.name }}.</p>
      </div>
      <NxButton v-if="auth.can('servicios.gestionar')" @click="create">Nuevo servicio</NxButton>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p
      v-else-if="!services?.length"
      class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600"
    >
      Todavía no hay servicios. Crea el primero para poder agendar.
    </p>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="service in services"
        :key="service.id"
        class="overflow-hidden rounded-lg border border-slate-200 bg-white"
        :class="{ 'opacity-60': !service.is_active }"
      >
        <div class="flex h-32 items-center justify-center bg-slate-100">
          <img
            v-if="service.image_url"
            :src="service.image_url"
            :alt="service.name"
            class="h-full w-full object-cover"
          />
          <span v-else class="text-sm text-slate-400">Sin imagen</span>
        </div>

        <div class="p-4">
          <div class="flex items-start justify-between gap-2">
            <h2 class="font-medium text-slate-800">{{ service.name }}</h2>
            <span class="shrink-0 font-medium tabular-nums text-slate-700">
              {{ money(service.price) }}
            </span>
          </div>

          <p class="mt-1 text-sm text-slate-500">
            {{ service.duration_min }} min
            <span v-if="service.occupied_min !== service.duration_min" class="text-slate-400">
              · ocupa {{ service.occupied_min }}
            </span>
          </p>

          <p class="mt-1 text-xs text-slate-500">
            {{ service.resource_ids?.length ?? 0 }} del equipo
            <span v-if="!service.is_bookable_online" class="ml-1 text-amber-700"
              >· solo en el local</span
            >
            <span v-if="!service.is_active" class="ml-1 text-slate-500">· inactivo</span>
          </p>

          <div v-if="auth.can('servicios.gestionar')" class="mt-3 flex gap-2">
            <NxButton variant="outline" size="sm" @click="edit(service)">Editar</NxButton>
            <NxButton v-if="service.is_active" variant="ghost" size="sm" @click="remove(service)">
              Desactivar
            </NxButton>
          </div>
        </div>
      </article>
    </div>

    <ServiceFormModal :service="editing" :open="open" @close="open = false" @saved="onSaved" />
  </section>
</template>
