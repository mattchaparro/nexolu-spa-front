<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  useProducts,
  useSellProduct,
  type AdminProduct,
} from '@/modules/catalog/composables/useProducts'
import { useMoney } from '@/modules/cash/composables/useMoney'
import { extractErrorMessage } from '@/utils/extractErrorMessage'

/*
|------------------------------------------------------------------------------
| Llevar un producto, mientras se cobra el servicio
|------------------------------------------------------------------------------
| Es donde más se vende una crema: la clienta está pagando y tiene el producto
| a la vista. Obligarla a ir a otra pantalla para eso es como se pierde la
| venta.
|
| La venta se registra APARTE del cobro del servicio, aunque quede colgada de
| la misma cita. No es descuido: un producto no genera comisión de servicio, y
| meterlo dentro del total de la cita haría que la manicurista cobrara
| porcentaje sobre una crema que no aplicó. Lo que sí se muestra junto es
| CUÁNTO HAY QUE COBRAR en total, que es lo único que el mostrador necesita.
*/

const props = defineProps<{
  appointmentId: number
  clientId: number | null
  paymentMethodId: number | null
}>()

const emit = defineEmits<{ vendido: [total: number] }>()

const { money } = useMoney()
const { data } = useProducts()
const { mutateAsync: vender, isPending } = useSellProduct()

const abierto = ref(false)
const error = ref<string | null>(null)

/** Lo vendido en ESTE cobro, para poder decir el total a cobrar. */
const vendido = ref<Array<{ name: string; quantity: number; total: number }>>([])

const disponibles = computed(() =>
  (data.value?.data ?? []).filter((p) => p.is_active && p.stock > 0),
)

const totalProductos = computed(() => vendido.value.reduce((s, v) => s + v.total, 0))

async function llevar(producto: AdminProduct): Promise<void> {
  error.value = null

  try {
    const r = await vender({
      id: producto.id,
      quantity: 1,
      appointment_id: props.appointmentId,
      client_id: props.clientId,
      payment_method_id: props.paymentMethodId,
    })

    vendido.value.push({ name: producto.name, quantity: 1, total: r.total })
    emit('vendido', totalProductos.value)
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos registrar el producto.')
  }
}
</script>

<template>
  <div class="rounded-md border border-slate-200 px-4 py-3 text-sm">
    <!-- Lo ya llevado, arriba: es lo que hay que cobrar de más. -->
    <div v-if="vendido.length" class="mb-2 flex flex-col gap-1">
      <p v-for="(v, i) in vendido" :key="i" class="flex justify-between text-slate-700">
        <span>{{ v.name }}</span>
        <span class="tabular-nums">{{ money(v.total) }}</span>
      </p>
      <p class="flex justify-between border-t border-slate-100 pt-1 font-medium text-slate-900">
        <span>Productos</span>
        <span class="tabular-nums">{{ money(totalProductos) }}</span>
      </p>
    </div>

    <button
      type="button"
      class="min-h-11 w-full text-left text-slate-600"
      @click="abierto = !abierto"
    >
      {{ abierto ? '− Cerrar productos' : '＋ ¿Lleva algún producto?' }}
    </button>

    <div v-if="abierto" class="mt-2">
      <p v-if="!disponibles.length" class="text-slate-500">No hay productos con existencia.</p>

      <!-- Un toque = una unidad. Tocar dos veces lleva dos: en un mostrador
           eso es más rápido que abrir un selector de cantidad, y el caso
           normal es llevarse uno. -->
      <div v-else class="flex flex-col gap-1.5">
        <button
          v-for="p in disponibles"
          :key="p.id"
          type="button"
          class="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 text-left active:bg-slate-50 disabled:opacity-50"
          :disabled="isPending"
          @click="llevar(p)"
        >
          <span class="min-w-0 flex-1 truncate text-slate-800">{{ p.name }}</span>
          <span class="shrink-0 text-xs text-slate-400">quedan {{ p.stock }}</span>
          <span class="shrink-0 font-medium tabular-nums text-slate-900">{{ money(p.price) }}</span>
        </button>
      </div>
    </div>

    <p v-if="error" class="mt-2 text-xs text-red-700">{{ error }}</p>
  </div>
</template>
