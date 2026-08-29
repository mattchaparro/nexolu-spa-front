<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxDatePicker, NxInput, NxModal, NxSelect } from '@/ui'

import { searchClients, useBookAppointment, type ClientOption } from '../composables/useAppointments'
import { useAvailability, type Service } from '../composables/useAvailability'

/**
 * De dónde viene la petición de agendar.
 *
 * Con `time` y `resourceId` viene del calendario: alguien tocó un hueco
 * concreto. Con los dos en null viene del botón «Agendar cita», y entonces el
 * modal tiene que ofrecer las horas él mismo -- que es justo lo que evita
 * tener que buscar el hueco a ojo en una rejilla.
 */
export interface SlotPick {
  date: string
  resourceId: number | null
  resourceName: string | null
  /** HH:MM en hora del negocio. */
  time: string | null
}

const props = defineProps<{
  pick: SlotPick | null
  services: Service[]
  /** Servicio preseleccionado, normalmente el del filtro de la agenda. */
  defaultServiceId: number | null
}>()

const emit = defineEmits<{ close: []; booked: [] }>()

const open = computed(() => props.pick !== null)
/** Sin hora: el modal la pide. */
const picking = computed(() => props.pick !== null && props.pick.time === null)

const serviceId = ref<number | null>(null)
const date = ref('')
const chosenResourceId = ref<number | null>(null)
const chosenTime = ref<string | null>(null)

const term = ref('')
const results = ref<ClientOption[]>([])
const selected = ref<ClientOption | null>(null)
const phone = ref('')
const notes = ref('')
const error = ref<string | null>(null)
const conflict = ref(false)

const { mutateAsync, isPending } = useBookAppointment()
const { data: availability, isFetching: loadingSlots } = useAvailability(serviceId, date)

const service = computed(() => props.services.find((s) => s.id === serviceId.value) ?? null)

/**
 * Qué servicios se pueden elegir.
 *
 * Desde el calendario, sólo los que esa persona presta: ofrecer el resto lleva
 * a un hueco que no existe. Desde el botón, todos -- la persona se elige
 * después, con las horas que de verdad quedan.
 */
const available = computed(() =>
  props.pick?.resourceId
    ? props.services.filter((s) => s.resource_ids?.includes(props.pick!.resourceId!) ?? true)
    : props.services,
)

const slots = computed(() => availability.value?.slots ?? [])

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

  // Si esa persona no presta el servicio del filtro, se elige el primero
  // que sí presta en vez de dejar el campo en algo imposible.
  const preferred = available.value.find((s) => s.id === props.defaultServiceId)
  serviceId.value = preferred?.id ?? available.value[0]?.id ?? null

  date.value = props.pick?.date ?? ''
  chosenResourceId.value = props.pick?.resourceId ?? null
  chosenTime.value = props.pick?.time ?? null

  term.value = ''
  results.value = []
  selected.value = null
  phone.value = ''
  notes.value = ''
  error.value = null
  conflict.value = false
})

// Cambiar de servicio o de día invalida la hora elegida: ese hueco era del
// servicio anterior y puede no existir para el nuevo.
watch([serviceId, date], () => {
  if (picking.value) {
    chosenTime.value = null
    chosenResourceId.value = null
  }
})

function pickSlot(slot: { starts_at: string; resource_id: number; label: string }): void {
  chosenResourceId.value = slot.resource_id
  // De la marca ISO a HH:MM en hora del negocio, que es lo que la API espera
  // cuando la cadena no lleva desfase.
  chosenTime.value = new Date(slot.starts_at).toTimeString().slice(0, 5)
}

function choose(client: ClientOption): void {
  selected.value = client
  term.value = client.full_name
  results.value = []
}

/** Con quién queda, para poder decirlo antes de confirmar. */
const chosenResourceName = computed(() => {
  if (props.pick?.resourceName) return props.pick.resourceName
  return slots.value.find((s) => s.resource_id === chosenResourceId.value)?.resource_name ?? null
})

const canSubmit = computed(
  () =>
    term.value.trim().length > 1 &&
    serviceId.value !== null &&
    chosenTime.value !== null &&
    chosenResourceId.value !== null &&
    !isPending.value,
)

async function submit(): Promise<void> {
  if (serviceId.value === null || chosenTime.value === null || chosenResourceId.value === null) {
    return
  }

  error.value = null
  conflict.value = false

  try {
    await mutateAsync({
      service_id: serviceId.value,
      resource_id: chosenResourceId.value,
      // El backend interpreta esta hora en la zona del negocio.
      starts_at: `${date.value} ${chosenTime.value}:00`,
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
      <!-- Resumen de lo elegido. Desde el calendario ya está todo; desde el
           botón se va llenando a medida que se elige. -->
      <div v-if="chosenTime" class="rounded-md bg-slate-50 px-4 py-3 text-sm">
        <p class="font-medium text-slate-800">
          {{ chosenTime }}<span v-if="chosenResourceName"> con {{ chosenResourceName }}</span>
        </p>
        <p v-if="service" class="text-slate-600">
          {{ service.name }} · {{ service.duration_min }} min
          <span v-if="service.occupied_min !== service.duration_min" class="text-slate-400">
            (ocupa {{ service.occupied_min }})
          </span>
        </p>
      </div>

      <div v-if="conflict" class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Ese horario acaba de ser tomado. Elige otro.
      </div>

      <template v-else>
        <p v-if="!available.length" class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {{ pick.resourceName ?? 'Esta persona' }} no tiene servicios asignados todavía.
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

        <!-- Elegir hora, sólo cuando no vino del calendario -->
        <template v-if="picking">
          <NxDatePicker v-model="date" label="Día" :disabled="isPending" />

          <div>
            <p class="mb-1.5 text-sm text-slate-600">Hora</p>

            <p v-if="loadingSlots" class="text-sm text-slate-500">Buscando horas libres…</p>

            <p v-else-if="!slots.length" class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
              No quedan horas ese día para este servicio. Prueba con otro día.
            </p>

            <div v-else class="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              <button
                v-for="(slot, i) in slots"
                :key="i"
                type="button"
                class="rounded-md border px-2.5 py-1.5 text-sm transition"
                :class="
                  chosenTime && chosenResourceId === slot.resource_id &&
                  slot.starts_at.includes(chosenTime)
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-700 hover:border-slate-400'
                "
                :disabled="isPending"
                @click="pickSlot(slot)"
              >
                {{ slot.label }}
                <span class="ml-1 text-xs text-slate-400">{{ slot.resource_name }}</span>
              </button>
            </div>
          </div>
        </template>

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
