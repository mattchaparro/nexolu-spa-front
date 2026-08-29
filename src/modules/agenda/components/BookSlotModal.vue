<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxModal, NxSelect } from '@/ui'

import { searchClients, useBookAppointment, type ClientOption } from '../composables/useAppointments'
import type { Service } from '../composables/useAvailability'

export interface SlotPick {
  date: string
  resourceId: number
  resourceName: string
  /** HH:MM en hora del negocio. */
  time: string
}

const props = defineProps<{
  pick: SlotPick | null
  services: Service[]
  /** Servicio preseleccionado, normalmente el del filtro de la agenda. */
  defaultServiceId: number | null
}>()

const emit = defineEmits<{ close: []; booked: [] }>()

const open = computed(() => props.pick !== null)

const serviceId = ref<number | null>(null)
const term = ref('')
const results = ref<ClientOption[]>([])
const selected = ref<ClientOption | null>(null)
const phone = ref('')
const notes = ref('')
const error = ref<string | null>(null)
const conflict = ref(false)

const { mutateAsync, isPending } = useBookAppointment()

const service = computed(() => props.services.find((s) => s.id === serviceId.value) ?? null)

/** Solo los servicios que esta profesional presta. */
const available = computed(() =>
  props.pick
    ? props.services.filter((s) => s.resource_ids?.includes(props.pick!.resourceId) ?? true)
    : [],
)

let timer: ReturnType<typeof setTimeout> | undefined
watch(term, (value) => {
  selected.value = null
  clearTimeout(timer)
  timer = setTimeout(async () => {
    results.value = await searchClients(value)
  }, 250)
})

watch(open, (isOpen) => {
  if (!isOpen) {
    return
  }

  // Si la profesional no presta el servicio del filtro, se elige el primero
  // que sí presta en vez de dejar el campo en algo imposible.
  const preferred = available.value.find((s) => s.id === props.defaultServiceId)
  serviceId.value = preferred?.id ?? available.value[0]?.id ?? null

  term.value = ''
  results.value = []
  selected.value = null
  phone.value = ''
  notes.value = ''
  error.value = null
  conflict.value = false
})

function choose(client: ClientOption): void {
  selected.value = client
  term.value = client.full_name
  results.value = []
}

const canSubmit = computed(
  () => term.value.trim().length > 1 && serviceId.value !== null && !isPending.value,
)

async function submit(): Promise<void> {
  if (!props.pick || serviceId.value === null) {
    return
  }

  error.value = null
  conflict.value = false

  try {
    await mutateAsync({
      service_id: serviceId.value,
      resource_id: props.pick.resourceId,
      // El backend interpreta esta hora en la zona del negocio.
      starts_at: `${props.pick.date} ${props.pick.time}:00`,
      client_id: selected.value?.id ?? null,
      client_name: selected.value?.full_name ?? term.value.trim(),
      client_phone: selected.value ? undefined : phone.value.trim() || undefined,
      notes: notes.value.trim() || undefined,
    })
    emit('booked')
  } catch (e) {
    if ((e as { response?: { status?: number } }).response?.status === 409) {
      conflict.value = true
      return
    }

    error.value = extractErrorMessage(e, 'No pudimos agendar la cita.')
  }
}
</script>

<template>
  <NxModal :model-value="open" title="Agendar cita" @update:model-value="emit('close')">
    <div v-if="pick" class="flex flex-col gap-4">
      <div class="rounded-md bg-slate-50 px-4 py-3 text-sm">
        <p class="font-medium text-slate-800">{{ pick.time }} con {{ pick.resourceName }}</p>
        <p v-if="service" class="text-slate-600">
          {{ service.name }} · {{ service.duration_min }} min
          <span v-if="service.occupied_min !== service.duration_min" class="text-slate-400">
            (ocupa {{ service.occupied_min }})
          </span>
        </p>
      </div>

      <div v-if="conflict" class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Ese horario acaba de ser tomado. Cierra y elige otro.
      </div>

      <template v-else>
        <p v-if="!available.length" class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {{ pick.resourceName }} no tiene servicios asignados todavía.
        </p>

        <NxSelect
          v-else
          v-model="serviceId"
          :options="available"
          option-label="name"
          option-value="id"
          label="Servicio"
          :disabled="isPending"
        />

        <div class="relative">
          <NxInput v-model="term" label="Cliente" :disabled="isPending" autocomplete="off" />

          <ul
            v-if="results.length"
            class="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
          >
            <li v-for="client in results" :key="client.id">
              <button
                type="button"
                class="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                @click="choose(client)"
              >
                {{ client.label }}
              </button>
            </li>
          </ul>

          <p v-if="selected" class="mt-1 text-xs text-emerald-700">
            Cliente existente · {{ selected.phone ?? 'sin teléfono' }}
          </p>
          <p v-else-if="term.trim().length > 1" class="mt-1 text-xs text-slate-500">
            Se guardará como cliente nuevo.
          </p>
        </div>

        <NxInput
          v-if="!selected"
          v-model="phone"
          label="Teléfono (opcional)"
          inputmode="tel"
          :disabled="isPending"
        />

        <NxInput v-model="notes" label="Nota (opcional)" :disabled="isPending" />

        <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>
      </template>

      <div class="flex justify-end gap-2">
        <NxButton variant="secondary" :disabled="isPending" @click="emit('close')">
          {{ conflict ? 'Cerrar' : 'Cancelar' }}
        </NxButton>
        <NxButton v-if="!conflict" :loading="isPending" :disabled="!canSubmit" @click="submit">
          Agendar
        </NxButton>
      </div>
    </div>
  </NxModal>
</template>
