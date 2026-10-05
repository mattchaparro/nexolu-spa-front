<script setup lang="ts">
/*
 * «Reagendar» desde la cita: el día, la hora, con quién y hasta el servicio.
 *
 * Antes solo se podía arrastrar la cita en el calendario -- que nadie
 * descubría, y en el celular casi no se puede -- y el servicio no se podía
 * cambiar: había que cancelar y volver a agendar. Una cita de varios
 * servicios solo se mueve de hora (cada tramo puede ser de alguien distinto).
 */
import { computed, ref, watch } from 'vue'

import { useAuthStore } from '@/stores/auth.store'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxSelect } from '@/ui'

import { useReschedule } from '../composables/useAgenda'
import type { Appointment } from '../composables/useAppointments'
import { useResources, useServices } from '../composables/useAvailability'

const props = defineProps<{ appointment: Appointment; silent: boolean }>()
const emit = defineEmits<{ moved: [] }>()

const auth = useAuthStore()
const { data: services } = useServices()
const { data: resources } = useResources()
const { mutateAsync, isPending } = useReschedule()

const unaSola = computed(() => props.appointment.items.length === 1)
const item = computed(() => props.appointment.items[0])

/** "2026-10-05" y "15:30" en la hora del navegador (la del local). */
function partes(iso: string): { dia: string; hora: string } {
  const d = new Date(iso)
  const dos = (n: number) => String(n).padStart(2, '0')
  return {
    dia: `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`,
    hora: `${dos(d.getHours())}:${dos(d.getMinutes())}`,
  }
}

const dia = ref('')
const hora = ref('')
const serviceId = ref<number | null>(null)
const resourceId = ref<number | null>(null)
const fueraDeTurno = ref(false)
const error = ref<string | null>(null)

watch(
  () => props.appointment.id,
  () => {
    const p = partes(item.value?.starts_at ?? props.appointment.starts_at)
    dia.value = p.dia
    hora.value = p.hora
    serviceId.value = item.value?.service_id ?? null
    resourceId.value = item.value?.resource_id ?? null
    fueraDeTurno.value = false
    error.value = null
  },
  { immediate: true },
)

const opcionesServicio = computed(() =>
  (services.value ?? []).map((s) => ({ id: s.id, label: s.name })),
)

/** Solo quien hace el servicio elegido (si el catálogo lo dice). */
const opcionesPersona = computed(() => {
  const servicio = services.value?.find((s) => s.id === serviceId.value)
  return (resources.value ?? [])
    .filter((r) => r.type === 'staff')
    .filter((r) => !servicio?.resource_ids || servicio.resource_ids.includes(r.id))
})

async function guardar(): Promise<void> {
  error.value = null

  try {
    await mutateAsync({
      id: props.appointment.id,
      starts_at: `${dia.value} ${hora.value}:00`,
      ...(unaSola.value && resourceId.value !== item.value?.resource_id
        ? { resource_id: resourceId.value ?? undefined }
        : {}),
      ...(unaSola.value && serviceId.value !== item.value?.service_id
        ? { service_id: serviceId.value ?? undefined }
        : {}),
      outside_schedule: fueraDeTurno.value || undefined,
      silent: props.silent || undefined,
    })
    emit('moved')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos reagendarla.')
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 rounded-md border border-indigo-200 bg-indigo-50/40 p-3">
    <NxSelect
      v-if="unaSola"
      v-model="serviceId"
      :options="opcionesServicio"
      option-label="label"
      option-value="id"
      label="Servicio"
      filter
      :disabled="isPending"
    />

    <div class="grid grid-cols-2 gap-3">
      <NxInput v-model="dia" type="date" label="Día" :disabled="isPending" />
      <NxInput v-model="hora" type="time" label="Hora" :disabled="isPending" />
    </div>

    <NxSelect
      v-if="unaSola"
      v-model="resourceId"
      :options="opcionesPersona"
      option-label="name"
      option-value="id"
      label="Con quién"
      :disabled="isPending"
    />
    <p v-else class="text-xs text-slate-500">
      Es una cita de varios servicios: se mueve completa a la nueva hora, con las mismas personas.
    </p>

    <label
      v-if="auth.can('horarios.gestionar')"
      class="flex items-center gap-2 text-sm text-slate-700"
    >
      <input v-model="fueraDeTurno" type="checkbox" :disabled="isPending" />
      Aunque quede fuera del turno
    </label>

    <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

    <div class="flex justify-end">
      <NxButton size="sm" :loading="isPending" :disabled="!dia || !hora" @click="guardar">
        Guardar cambios
      </NxButton>
    </div>
  </div>
</template>
