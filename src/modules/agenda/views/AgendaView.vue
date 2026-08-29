<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useAuthStore } from '@/stores/auth.store'
import { NxButton, NxDatePicker, NxSelect } from '@/ui'

import BookSlotModal from '../components/BookSlotModal.vue'
import { useAppointments, useCancelAppointment } from '../composables/useAppointments'
import { useAvailability, useResources, useServices, type Slot } from '../composables/useAvailability'

const auth = useAuthStore()
const { notify } = useSystemAlert()

const date = ref(new Date().toISOString().slice(0, 10))
const serviceId = ref<number | null>(null)
const slotToBook = ref<Slot | null>(null)

const { data: services, isLoading: loadingServices } = useServices()
const { data: resources } = useResources()
const { data: availability, isFetching } = useAvailability(serviceId, date)
const { data: appointments } = useAppointments(date)
const { mutateAsync: cancelAppointment } = useCancelAppointment()

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

/** Solo los recursos que atienden: una cabina se ocupa, pero no es columna. */
const staff = computed(() => resources.value?.filter((r) => r.type === 'staff') ?? [])

const columns = computed(() =>
  staff.value.map((resource) => ({
    id: resource.id,
    name: resource.name,
    color: resource.color,
    slots: (availability.value?.slots ?? []).filter((s) => s.resource_id === resource.id),
    booked: (appointments.value ?? []).filter((a) =>
      a.items.some((item) => item.resource_id === resource.id),
    ),
  })),
)

const totalSlots = computed(() => availability.value?.slots.length ?? 0)

function money(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: auth.business?.currency ?? 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function onBooked(): void {
  slotToBook.value = null
  notify('Cita agendada.', 'success')
}

async function cancel(id: number, who: string | null): Promise<void> {
  if (!window.confirm(`¿Cancelar la cita de ${who ?? 'este cliente'}?`)) {
    return
  }

  await cancelAppointment({ id })
  notify('Cita cancelada. El horario vuelve a estar libre.', 'success')
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

    <p class="mb-4 text-sm text-slate-500">
      <span v-if="isFetching">Calculando disponibilidad…</span>
      <span v-else>
        {{ totalSlots }} horarios disponibles ·
        {{ appointments?.length ?? 0 }} citas agendadas
      </span>
    </p>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="column in columns"
        :key="column.id"
        class="overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <header
          class="flex items-center gap-2 border-b border-slate-100 px-4 py-3"
          :style="column.color ? { borderLeft: `3px solid ${column.color}` } : undefined"
        >
          <span class="font-medium text-slate-700">{{ column.name }}</span>
          <span class="text-xs text-slate-400">{{ column.slots.length }} libres</span>
        </header>

        <!-- Lo agendado va primero: es lo que la recepcionista necesita ver
             de un vistazo, no la lista de lo que todavía está libre. -->
        <div v-if="column.booked.length" class="border-b border-slate-100 bg-indigo-50/40 p-3">
          <div
            v-for="appointment in column.booked"
            :key="appointment.id"
            class="flex items-start justify-between gap-2 rounded px-2 py-1.5 text-sm"
          >
            <div>
              <span class="font-medium tabular-nums text-slate-800">{{ appointment.label }}</span>
              <span class="ml-2 text-slate-700">{{ appointment.client_name }}</span>
              <p class="text-xs text-slate-500">
                {{ appointment.items[0]?.service_name }} · {{ appointment.status_label }}
              </p>
            </div>
            <NxButton
              v-if="auth.can('citas.cancelar')"
              variant="ghost"
              size="sm"
              @click="cancel(appointment.id, appointment.client_name)"
            >
              Cancelar
            </NxButton>
          </div>
        </div>

        <div v-if="column.slots.length" class="flex flex-wrap gap-2 p-4">
          <button
            v-for="slot in column.slots"
            :key="slot.starts_at"
            type="button"
            class="rounded border border-slate-200 px-2 py-1 text-sm tabular-nums text-slate-700 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
            :disabled="!auth.can('citas.crear')"
            @click="slotToBook = slot"
          >
            {{ slot.label }}
          </button>
        </div>

        <p v-else class="px-4 py-6 text-sm text-slate-400">Sin horarios libres este día.</p>
      </article>
    </div>

    <BookSlotModal
      :slot="slotToBook"
      :service="selectedService"
      @close="slotToBook = null"
      @booked="onBooked"
    />
  </section>
</template>
