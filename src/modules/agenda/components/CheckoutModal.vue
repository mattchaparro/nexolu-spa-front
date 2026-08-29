<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { usePaymentMethods } from '@/composables/usePaymentMethods'
import { useAuthStore } from '@/stores/auth.store'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxModal, NxSelect } from '@/ui'

import { useCancelAppointment, useCheckout, type Appointment } from '../composables/useAppointments'

const props = defineProps<{ appointment: Appointment | null }>()
const emit = defineEmits<{ close: []; done: []; cancelled: [] }>()

const { mutateAsync: cancelMutation } = useCancelAppointment()

async function cancelAppointment(): Promise<void> {
  if (!props.appointment) {
    return
  }

  const who = props.appointment.client_name ?? 'este cliente'

  if (!window.confirm(`¿Cancelar la cita de ${who}? El horario vuelve a quedar libre.`)) {
    return
  }

  await cancelMutation({ id: props.appointment.id })
  emit('cancelled')
}

const auth = useAuthStore()
const open = computed(() => props.appointment !== null)

const paymentMethodId = ref<number | null>(null)
const discount = ref('')
const discountReason = ref('')
const error = ref<string | null>(null)

const { data: methods } = usePaymentMethods()

const { mutateAsync, isPending } = useCheckout()

const subtotal = computed(
  () => props.appointment?.items.reduce((sum, item) => sum + item.price, 0) ?? 0,
)
const discountValue = computed(() => Math.max(0, Number(discount.value) || 0))
const total = computed(() => Math.max(0, subtotal.value - discountValue.value))

/** Lo que cada profesional se lleva, con el descuento ya repartido. */
const commissions = computed(() => {
  const items = props.appointment?.items ?? []

  return items.map((item) => {
    const share = subtotal.value > 0 ? (item.price / subtotal.value) * discountValue.value : 0
    return {
      name: item.resource_name,
      rate: item.commission_rate ?? 0,
      amount: (item.price - share) * (item.commission_rate ?? 0),
    }
  })
})

watch(open, (isOpen) => {
  if (isOpen) {
    paymentMethodId.value = methods.value?.[0]?.id ?? null
    discount.value = ''
    discountReason.value = ''
    error.value = null
  }
})

watch(methods, (list) => {
  if (open.value && !paymentMethodId.value && list?.length) {
    paymentMethodId.value = list[0].id
  }
})

function money(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: auth.business?.currency ?? 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

const canSubmit = computed(
  () => paymentMethodId.value !== null && discountValue.value <= subtotal.value && !isPending.value,
)

async function submit(): Promise<void> {
  if (!props.appointment || paymentMethodId.value === null) {
    return
  }

  error.value = null

  try {
    await mutateAsync({
      id: props.appointment.id,
      payment_method_id: paymentMethodId.value,
      discount_amount: discountValue.value || undefined,
      discount_reason: discountReason.value.trim() || undefined,
    })
    emit('done')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos registrar el cobro.')
  }
}
</script>

<template>
  <NxModal :model-value="open" title="Cobrar servicio" @update:model-value="emit('close')">
    <div v-if="appointment" class="flex flex-col gap-4">
      <div class="rounded-md bg-slate-50 px-4 py-3 text-sm">
        <p class="font-medium text-slate-800">{{ appointment.client_name }}</p>
        <p
          v-for="item in appointment.items"
          :key="item.id"
          class="flex justify-between text-slate-600"
        >
          <span>{{ item.service_name }} · {{ item.resource_name }}</span>
          <span class="tabular-nums">{{ money(item.price) }}</span>
        </p>
      </div>

      <NxSelect
        v-model="paymentMethodId"
        :options="methods ?? []"
        option-label="name"
        option-value="id"
        label="Método de pago"
        :disabled="isPending"
      />

      <div class="flex gap-3">
        <div class="w-40">
          <NxInput v-model="discount" label="Descuento" inputmode="numeric" :disabled="isPending" />
        </div>
        <div class="flex-1">
          <NxInput
            v-model="discountReason"
            label="Motivo (opcional)"
            :disabled="isPending || discountValue === 0"
          />
        </div>
      </div>

      <div class="rounded-md border border-slate-200 px-4 py-3 text-sm">
        <p class="flex justify-between text-slate-600">
          <span>Subtotal</span><span class="tabular-nums">{{ money(subtotal) }}</span>
        </p>
        <p v-if="discountValue > 0" class="flex justify-between text-amber-700">
          <span>Descuento</span><span class="tabular-nums">−{{ money(discountValue) }}</span>
        </p>
        <p class="mt-1 flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900">
          <span>Total</span><span class="tabular-nums">{{ money(total) }}</span>
        </p>
      </div>

      <!-- La comisión se muestra ANTES de confirmar: quien cobra debe poder
           ver qué se le va a liquidar a cada profesional, no enterarse
           después en un reporte. -->
      <div class="text-sm">
        <p class="mb-1 text-xs uppercase tracking-wide text-slate-400">Comisión</p>
        <p
          v-for="(commission, i) in commissions"
          :key="i"
          class="flex justify-between text-slate-600"
        >
          <span>{{ commission.name }} · {{ Math.round(commission.rate * 100) }}%</span>
          <span class="tabular-nums">{{ money(commission.amount) }}</span>
        </p>
      </div>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex items-center justify-between gap-2">
        <!-- Cancelar la cita vive aca porque este modal es, en la practica, el
             detalle de la cita: es donde se actua sobre ella. -->
        <NxButton
          v-if="auth.can('citas.cancelar')"
          variant="ghost"
          size="sm"
          :disabled="isPending"
          @click="cancelAppointment"
        >
          Cancelar cita
        </NxButton>
        <span v-else />

        <div class="flex gap-2">
          <NxButton variant="secondary" :disabled="isPending" @click="emit('close')">Cerrar</NxButton>
          <NxButton :loading="isPending" :disabled="!canSubmit" @click="submit">
            Cobrar {{ money(total) }}
          </NxButton>
        </div>
      </div>
    </div>
  </NxModal>
</template>
