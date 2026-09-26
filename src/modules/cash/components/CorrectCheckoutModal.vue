<script setup lang="ts">
/*
 * Corregir un cobro ya hecho: el servicio, lo cobrado o el medio.
 *
 * Para cuando se equivocaron al cobrar -- Semi en vez de Semi + Rubber,
 * 45.000 en vez de 50.000, Efectivo en vez de Bold. El cobro se queda en el
 * día en que se hizo, la comisión se recalcula con lo nuevo y queda una nota
 * en la cita con quién lo cambió. No le avisa a nadie.
 */
import { computed, ref, watch } from 'vue'

import { usePaymentMethods } from '@/composables/usePaymentMethods'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxModal, NxSelect } from '@/ui'

import { useServices } from '@/modules/agenda/composables/useAvailability'

import { useCorrectCheckout, type DailySummaryLine } from '../composables/useCash'
import { useMoney } from '../composables/useMoney'

const props = defineProps<{ lines: DailySummaryLine[] }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { money } = useMoney()
const { data: services } = useServices()
const { data: methods } = usePaymentMethods()
const { mutateAsync, isPending } = useCorrectCheckout()

const open = computed(() => props.lines.length > 0)

/** Por línea: el servicio y lo cobrado, editables. */
const edit = ref<Record<number, { service_id: number; charged: string }>>({})
const paymentMethodId = ref<number | null>(null)
const error = ref<string | null>(null)

watch(
  () => props.lines,
  (lines) => {
    edit.value = Object.fromEntries(
      lines.map((l) => [l.item_id, { service_id: l.service_id, charged: String(l.charged) }]),
    )
    paymentMethodId.value = lines[0]?.payment_method_id ?? null
    error.value = null
  },
  { immediate: true },
)

/*
 * Los medios activos más el que se usó: un cobro de antes pudo ser por Nequi,
 * que ya no se ofrece, y corregir el valor no puede obligar a cambiarle el medio.
 */
const medios = computed(() => {
  const activos = methods.value ?? []
  const usado = props.lines[0]

  if (!usado?.payment_method_id || activos.some((m) => m.id === usado.payment_method_id)) {
    return activos
  }

  return [...activos, { id: usado.payment_method_id, name: usado.payment_method }]
})

const opcionesServicio = computed(() =>
  (services.value ?? []).map((s) => ({ id: s.id, label: `${s.name} · ${money(s.price)}` })),
)

function precioDe(serviceId: number): number | null {
  return services.value?.find((s) => s.id === serviceId)?.price ?? null
}

/** Al cambiar el servicio, lo cobrado pasa al precio del nuevo (se puede ajustar). */
function onService(itemId: number, serviceId: number): void {
  const precio = precioDe(serviceId)
  edit.value[itemId] = {
    service_id: serviceId,
    charged: precio !== null ? String(precio) : edit.value[itemId].charged,
  }
}

const total = computed(() =>
  Object.values(edit.value).reduce((sum, l) => sum + (Number(l.charged) || 0), 0),
)
const totalAntes = computed(() => props.lines.reduce((sum, l) => sum + l.charged, 0))

async function save(): Promise<void> {
  if (paymentMethodId.value === null || !props.lines.length) {
    return
  }

  error.value = null

  try {
    await mutateAsync({
      appointmentId: props.lines[0].appointment_id,
      payment_method_id: paymentMethodId.value,
      lines: props.lines.map((l) => ({
        id: l.item_id,
        service_id: edit.value[l.item_id].service_id,
        charged: Math.max(0, Number(edit.value[l.item_id].charged) || 0),
      })),
    })
    emit('saved')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos corregir el cobro.')
  }
}
</script>

<template>
  <NxModal :model-value="open" title="Corregir cobro" @update:model-value="emit('close')">
    <div v-if="lines.length" class="flex flex-col gap-4">
      <p class="text-sm text-slate-600">
        <span class="font-medium text-slate-800">{{ lines[0].client_name ?? 'Sin nombre' }}</span>
        · cobrado a las {{ lines[0].charged_at }}
      </p>

      <div
        v-for="l in lines"
        :key="l.item_id"
        class="flex flex-col gap-2 rounded-md border border-slate-200 p-3"
      >
        <p class="text-xs text-slate-500">{{ l.resource_name }}</p>
        <NxSelect
          :model-value="edit[l.item_id]?.service_id"
          :options="opcionesServicio"
          option-label="label"
          option-value="id"
          label="Servicio"
          filter
          :disabled="isPending"
          @update:model-value="(v) => onService(l.item_id, Number(v))"
        />
        <label class="text-sm text-slate-700">
          Cobrado
          <input
            v-model="edit[l.item_id].charged"
            type="number"
            inputmode="numeric"
            min="0"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-right tabular-nums"
            :disabled="isPending"
          />
        </label>
      </div>

      <div>
        <p class="mb-1.5 text-sm font-medium text-slate-700">Medio de pago</p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            v-for="m in medios"
            :key="m.id"
            type="button"
            class="rounded-lg border px-3 py-2.5 text-sm font-medium transition"
            :class="
              paymentMethodId === m.id
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 text-slate-700 hover:border-indigo-300'
            "
            :disabled="isPending"
            @click="paymentMethodId = m.id"
          >
            {{ m.name }}
          </button>
        </div>
      </div>

      <p class="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
        <span class="text-slate-600">Antes {{ money(totalAntes) }}</span>
        <span class="font-semibold text-slate-900">Ahora {{ money(total) }}</span>
      </p>
      <p class="text-xs text-slate-500">
        Queda en el día en que se cobró. La comisión se recalcula con lo nuevo y no se le avisa a
        nadie.
      </p>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <NxButton variant="secondary" :disabled="isPending" @click="emit('close')"
          >Cancelar</NxButton
        >
        <NxButton :loading="isPending" :disabled="paymentMethodId === null" @click="save">
          Guardar corrección
        </NxButton>
      </div>
    </div>
  </NxModal>
</template>
