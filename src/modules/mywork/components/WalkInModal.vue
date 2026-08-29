<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'
import { usePaymentMethods } from '@/composables/usePaymentMethods'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxModal, NxSelect } from '@/ui'

import { searchClients, type ClientOption } from '@/modules/agenda/composables/useAppointments'
import { useServices } from '@/modules/agenda/composables/useAvailability'
import { useMoney } from '@/modules/cash/composables/useMoney'

import { useWalkIn } from '../composables/useMyWork'

const props = defineProps<{
  open: boolean
  /** Recurso propio, si quien registra atiende. */
  myResourceId: number | null
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const { money } = useMoney()
const { mutateAsync, isPending } = useWalkIn()

const { data: services } = useServices()

const { data: resources } = useQuery({
  queryKey: ['resources'],
  staleTime: 5 * 60_000,
  queryFn: async () =>
    (await httpClient.get<Array<{ id: number; name: string; type: string }>>('/resources')).data,
})

const { data: methods } = usePaymentMethods()

const staff = computed(() => resources.value?.filter((r) => r.type === 'staff') ?? [])

const serviceId = ref<number | null>(null)
const resourceId = ref<number | null>(null)
const term = ref('')
const results = ref<ClientOption[]>([])
const selected = ref<ClientOption | null>(null)
const phone = ref('')
const methodId = ref<number | null>(null)
const price = ref('')
const chargeNow = ref(true)
const error = ref<string | null>(null)

const service = computed(() => services.value?.find((s) => s.id === serviceId.value) ?? null)

/** Quien no atiende tiene que decir quién lo hizo. */
const mustPickResource = computed(() => props.myResourceId === null)

let timer: ReturnType<typeof setTimeout> | undefined
watch(term, (value) => {
  selected.value = null
  clearTimeout(timer)
  timer = setTimeout(async () => {
    results.value = await searchClients(value)
  }, 250)
})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return

    serviceId.value = services.value?.[0]?.id ?? null
    resourceId.value = props.myResourceId
    term.value = ''
    results.value = []
    selected.value = null
    phone.value = ''
    methodId.value = methods.value?.[0]?.id ?? null
    price.value = ''
    chargeNow.value = true
    error.value = null
  },
)

watch(service, (s) => {
  // El precio de lista como punto de partida, editable: un servicio sin cita
  // se negocia más a menudo que uno agendado.
  price.value = s ? String(s.price) : ''
})

function choose(client: ClientOption): void {
  selected.value = client
  term.value = client.full_name
  results.value = []
}

const canSubmit = computed(
  () =>
    serviceId.value !== null &&
    term.value.trim().length > 1 &&
    (!mustPickResource.value || resourceId.value !== null) &&
    !isPending.value,
)

async function submit(): Promise<void> {
  error.value = null

  try {
    await mutateAsync({
      service_id: serviceId.value!,
      resource_id: resourceId.value,
      client_id: selected.value?.id ?? null,
      client_name: selected.value?.full_name ?? term.value.trim(),
      client_phone: selected.value ? undefined : phone.value.trim() || undefined,
      payment_method_id: chargeNow.value ? methodId.value : null,
      final_price: chargeNow.value && price.value !== '' ? Number(price.value) : undefined,
    })
    emit('saved')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos registrar el servicio.')
  }
}
</script>

<template>
  <NxModal :model-value="open" title="Servicio sin cita" @update:model-value="emit('close')">
    <div class="flex flex-col gap-4">
      <p class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Para alguien que llegó sin agendar. Queda registrado igual que una cita:
        cuenta para tu comisión y para el cierre del día.
      </p>

      <NxSelect
        v-model="serviceId"
        :options="services ?? []"
        option-label="name"
        option-value="id"
        label="Servicio"
        :disabled="isPending"
      />

      <NxSelect
        v-if="mustPickResource"
        v-model="resourceId"
        :options="staff"
        option-label="name"
        option-value="id"
        label="¿Quién atendió?"
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

      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input v-model="chargeNow" type="checkbox" :disabled="isPending" />
        Cobrar ahora
      </label>

      <div v-if="chargeNow" class="grid gap-3 sm:grid-cols-2">
        <NxSelect
          v-model="methodId"
          :options="methods ?? []"
          option-label="name"
          option-value="id"
          label="Método de pago"
          :disabled="isPending"
        />
        <NxInput v-model="price" label="Precio cobrado" inputmode="numeric" :disabled="isPending" />
      </div>

      <p v-else class="text-xs text-slate-500">
        Queda registrado sin cobrar. Se cobra después desde la agenda.
      </p>

      <p v-if="service && chargeNow" class="text-xs text-slate-500">
        Precio de lista {{ money(service.price) }} · {{ service.duration_min }} min
      </p>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <NxButton variant="secondary" :disabled="isPending" @click="emit('close')">Cancelar</NxButton>
        <NxButton :loading="isPending" :disabled="!canSubmit" @click="submit">Registrar</NxButton>
      </div>
    </div>
  </NxModal>
</template>
