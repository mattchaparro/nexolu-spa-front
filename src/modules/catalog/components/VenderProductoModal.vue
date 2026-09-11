<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { usePaymentMethods } from '@/composables/usePaymentMethods'
import { useMoney } from '@/modules/cash/composables/useMoney'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxModal, NxSelect } from '@/ui'

import { useSellProduct, type AdminProduct } from '../composables/useProducts'

/*
|------------------------------------------------------------------------------
| Vender un producto suelto
|------------------------------------------------------------------------------
| Hay quien entra sólo a comprar una crema, sin hacerse nada. Ese caso existe y
| en el sistema viejo era el único que había — por eso las ventas vivían en una
| tabla aparte que no cuadraba con nada.
|
| Acá la venta suelta y la que va con un servicio son la misma cosa: cambia si
| lleva cita colgada o no. Así el ingreso entra igual en el cierre del día por
| los dos caminos.
*/

const props = defineProps<{ product: AdminProduct | null; open: boolean }>()
const emit = defineEmits<{ close: []; sold: [] }>()

const { money } = useMoney()
const { data: methods } = usePaymentMethods()
const { mutateAsync: vender, isPending } = useSellProduct()

const cantidad = ref(1)
const metodoId = ref<number | null>(null)
const error = ref<string | null>(null)

watch(
  () => props.open,
  (abierto) => {
    if (abierto) {
      cantidad.value = 1
      error.value = null
      // El primer medio de pago, que en un mostrador es el de siempre.
      metodoId.value = methods.value?.[0]?.id ?? null
    }
  },
)

const total = computed(() => (props.product?.price ?? 0) * cantidad.value)

/** No se puede vender más de lo que hay: el servidor también lo rechaza. */
const puedeVender = computed(
  () =>
    props.product !== null &&
    cantidad.value >= 1 &&
    cantidad.value <= (props.product?.stock ?? 0) &&
    !isPending.value,
)

async function confirmar(): Promise<void> {
  if (!props.product) return

  error.value = null

  try {
    await vender({
      id: props.product.id,
      quantity: cantidad.value,
      payment_method_id: metodoId.value,
    })
    emit('sold')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos registrar la venta.')
  }
}
</script>

<template>
  <NxModal :model-value="open" title="Vender producto" @update:model-value="emit('close')">
    <div v-if="product" class="flex flex-col gap-4">
      <div>
        <p class="font-medium text-slate-900">{{ product.name }}</p>
        <p class="text-sm text-slate-500">
          {{ money(product.price) }} · quedan {{ product.stock }}
        </p>
      </div>

      <label class="text-sm font-medium text-slate-700">
        Cuántos
        <input
          v-model.number="cantidad"
          type="number"
          min="1"
          :max="product.stock"
          class="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900"
          :disabled="isPending"
        />
        <span v-if="cantidad > product.stock" class="mt-1 block text-xs font-normal text-amber-700">
          Sólo quedan {{ product.stock }}.
        </span>
      </label>

      <NxSelect
        v-model="metodoId"
        :options="methods ?? []"
        option-label="name"
        option-value="id"
        label="Método de pago"
        :disabled="isPending"
      />

      <p class="text-lg font-semibold text-slate-900">Total: {{ money(total) }}</p>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <NxButton variant="ghost" :disabled="isPending" @click="emit('close')">Cancelar</NxButton>
        <NxButton :loading="isPending" :disabled="!puedeVender" @click="confirmar">
          Cobrar {{ money(total) }}
        </NxButton>
      </div>
    </div>
  </NxModal>
</template>
