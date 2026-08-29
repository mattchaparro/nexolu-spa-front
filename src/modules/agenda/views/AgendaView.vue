<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useAuthStore } from '@/stores/auth.store'
import { NxDatePicker, NxSelect } from '@/ui'

import { useAvailability, useResources, useServices, type Slot } from '../composables/useAvailability'

const auth = useAuthStore()

const today = new Date().toISOString().slice(0, 10)
const date = ref(today)
const serviceId = ref<number | null>(null)

const { data: services, isLoading: loadingServices } = useServices()
const { data: resources } = useResources()
const { data: availability, isFetching } = useAvailability(serviceId, date)

// Preseleccionar el primer servicio: entrar a la agenda y no ver nada hasta
// elegir algo de un desplegable es una pantalla vacia sin motivo.
watch(
  services,
  (list) => {
    if (!serviceId.value && list?.length) {
      serviceId.value = list[0].id
    }
  },
  { immediate: true },
)

const selectedService = computed(
  () => services.value?.find((s) => s.id === serviceId.value) ?? null,
)

/** Solo los recursos que pueden atender: una cabina no es una columna de agenda. */
const staff = computed(() => resources.value?.filter((r) => r.type === 'staff') ?? [])

/** Huecos agrupados por profesional, para leerlos como columnas. */
const byResource = computed<Array<{ id: number; name: string; color: string | null; slots: Slot[] }>>(
  () => {
    const slots = availability.value?.slots ?? []

    return staff.value.map((resource) => ({
      id: resource.id,
      name: resource.name,
      color: resource.color,
      slots: slots.filter((slot) => slot.resource_id === resource.id),
    }))
  },
)

const totalSlots = computed(() => availability.value?.slots.length ?? 0)

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
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Agenda</h1>
      <p class="mt-1 text-sm text-slate-500">
        {{ auth.business?.name }}
        <span v-if="availability" class="text-slate-400">· {{ availability.timezone }}</span>
      </p>
    </header>

    <div class="mb-6 flex flex-wrap items-end gap-4">
      <div class="w-64">
        <NxSelect
          v-model="serviceId"
          :options="services ?? []"
          option-label="name"
          option-value="id"
          label="Servicio"
          :disabled="loadingServices"
        />
      </div>

      <div class="w-48">
        <NxDatePicker v-model="date" label="Fecha" />
      </div>

      <p v-if="selectedService" class="pb-2 text-sm text-slate-500">
        {{ selectedService.duration_min }} min · {{ money(selectedService.price) }}
        <span
          v-if="selectedService.occupied_min !== selectedService.duration_min"
          class="text-slate-400"
        >
          (ocupa {{ selectedService.occupied_min }} min con preparación y limpieza)
        </span>
      </p>
    </div>

    <p v-if="isFetching" class="text-sm text-slate-500">Calculando disponibilidad…</p>

    <p v-else-if="totalSlots === 0" class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600">
      No hay horarios disponibles para este servicio en la fecha elegida.
    </p>

    <div v-else>
      <p class="mb-4 text-sm text-slate-500">
        {{ totalSlots }} horarios disponibles
      </p>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="column in byResource"
          :key="column.id"
          class="rounded-lg border border-slate-200 bg-white"
        >
          <header
            class="flex items-center gap-2 border-b border-slate-100 px-4 py-3"
            :style="column.color ? { borderLeft: `3px solid ${column.color}` } : undefined"
          >
            <span class="font-medium text-slate-700">{{ column.name }}</span>
            <span class="text-xs text-slate-400">{{ column.slots.length }} huecos</span>
          </header>

          <div v-if="column.slots.length" class="flex flex-wrap gap-2 p-4">
            <span
              v-for="slot in column.slots"
              :key="slot.starts_at"
              class="rounded border border-slate-200 px-2 py-1 text-sm tabular-nums text-slate-700"
            >
              {{ slot.label }}
            </span>
          </div>

          <p v-else class="px-4 py-6 text-sm text-slate-400">Sin disponibilidad este día.</p>
        </article>
      </div>
    </div>
  </section>
</template>
