<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxModal } from '@/ui'

import { searchClients, useBookAppointment, type ClientOption } from '../composables/useAppointments'
import type { Service, Slot } from '../composables/useAvailability'

const props = defineProps<{
  slot: Slot | null
  service: Service | null
}>()

const emit = defineEmits<{ close: []; booked: [] }>()

const open = computed(() => props.slot !== null)

const term = ref('')
const results = ref<ClientOption[]>([])
const selected = ref<ClientOption | null>(null)
const phone = ref('')
const notes = ref('')
const error = ref<string | null>(null)
const conflict = ref(false)

const { mutateAsync, isPending } = useBookAppointment()

// Buscador con retraso: sin esto se dispara una petición por tecla.
let timer: ReturnType<typeof setTimeout> | undefined
watch(term, (value) => {
  selected.value = null
  clearTimeout(timer)
  timer = setTimeout(async () => {
    results.value = await searchClients(value)
  }, 250)
})

watch(open, (isOpen) => {
  if (isOpen) {
    term.value = ''
    results.value = []
    selected.value = null
    phone.value = ''
    notes.value = ''
    error.value = null
    conflict.value = false
  }
})

function choose(client: ClientOption): void {
  selected.value = client
  term.value = client.full_name
  results.value = []
}

const canSubmit = computed(() => term.value.trim().length > 1 && !isPending.value)

async function submit(): Promise<void> {
  if (!props.slot || !props.service) {
    return
  }

  error.value = null
  conflict.value = false

  try {
    await mutateAsync({
      service_id: props.service.id,
      resource_id: props.slot.resource_id,
      starts_at: props.slot.starts_at,
      client_id: selected.value?.id ?? null,
      // Con cliente elegido el nombre igual viaja: la cita guarda con quién
      // fue, aunque después alguien edite o borre la ficha del cliente.
      client_name: selected.value?.full_name ?? term.value.trim(),
      client_phone: selected.value ? undefined : phone.value.trim() || undefined,
      notes: notes.value.trim() || undefined,
    })
    emit('booked')
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status

    if (status === 409) {
      // Alguien tomó el horario mientras esta pantalla estaba abierta. No es
      // un error del sistema: la lista ya se recargó sola.
      conflict.value = true
      return
    }

    error.value = extractErrorMessage(e, 'No pudimos agendar la cita.')
  }
}
</script>

<template>
  <NxModal :model-value="open" title="Agendar cita" @update:model-value="emit('close')">
    <div v-if="slot && service" class="flex flex-col gap-4">
      <div class="rounded-md bg-slate-50 px-4 py-3 text-sm">
        <p class="font-medium text-slate-800">{{ service.name }}</p>
        <p class="text-slate-600">
          {{ slot.label }} con {{ slot.resource_name }} · {{ service.duration_min }} min
        </p>
      </div>

      <div v-if="conflict" class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Ese horario acaba de ser tomado. Cierra y elige otro.
      </div>

      <template v-else>
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
