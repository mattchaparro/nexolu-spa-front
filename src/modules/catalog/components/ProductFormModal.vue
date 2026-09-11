<script setup lang="ts">
import { ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxModal } from '@/ui'

import { useSaveProduct, type AdminProduct } from '../composables/useProducts'

const props = defineProps<{ product: AdminProduct | null; open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { mutateAsync: guardar, isPending } = useSaveProduct()

const nombre = ref('')
const precio = ref<number | null>(null)
const costo = ref<number | null>(null)
const avisarEn = ref<number | null>(null)
const existenciaInicial = ref<number | null>(null)
const imagen = ref<File | null>(null)
const error = ref<string | null>(null)

watch(
  () => props.open,
  (abierto) => {
    if (!abierto) return

    error.value = null
    imagen.value = null
    nombre.value = props.product?.name ?? ''
    precio.value = props.product?.price ?? null
    costo.value = props.product?.cost ?? null
    avisarEn.value = props.product?.low_stock_at ?? null
    existenciaInicial.value = null
  },
)

async function submit(): Promise<void> {
  error.value = null

  const payload = new FormData()
  payload.append('name', nombre.value.trim())
  payload.append('price', String(precio.value ?? 0))

  if (costo.value !== null) payload.append('cost', String(costo.value))
  if (avisarEn.value !== null) payload.append('low_stock_at', String(avisarEn.value))
  if (imagen.value) payload.append('image', imagen.value)

  // Sólo al crear: después el stock se mueve, no se escribe.
  if (!props.product && existenciaInicial.value) {
    payload.append('initial_stock', String(existenciaInicial.value))
  }

  try {
    await guardar({ id: props.product?.id, payload })
    emit('saved')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar el producto.')
  }
}
</script>

<template>
  <NxModal
    :model-value="open"
    :title="product ? 'Editar producto' : 'Nuevo producto'"
    size="lg"
    @update:model-value="emit('close')"
  >
    <div class="flex flex-col gap-4">
      <NxInput v-model="nombre" label="Nombre" :disabled="isPending" />

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="text-sm font-medium text-slate-700">
          Precio de venta
          <input
            v-model.number="precio"
            type="number"
            min="0"
            class="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900"
            :disabled="isPending"
          />
        </label>

        <label class="text-sm font-medium text-slate-700">
          Lo que te cuesta (opcional)
          <input
            v-model.number="costo"
            type="number"
            min="0"
            class="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900"
            :disabled="isPending"
          />
          <!-- Sin el costo, "vendí 1.070.000 en producto" no dice si se ganó o
               se perdió plata. -->
          <span class="mt-1 block text-xs font-normal text-slate-500">
            Sirve para saber cuánto dejó de ganancia.
          </span>
        </label>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="text-sm font-medium text-slate-700">
          Avisarme cuando queden (opcional)
          <input
            v-model.number="avisarEn"
            type="number"
            min="0"
            class="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900"
            :disabled="isPending"
          />
        </label>

        <label v-if="!product" class="text-sm font-medium text-slate-700">
          Cuántos tienes hoy
          <input
            v-model.number="existenciaInicial"
            type="number"
            min="0"
            class="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900"
            :disabled="isPending"
          />
          <span class="mt-1 block text-xs font-normal text-slate-500">
            Después se ajusta con entradas y conteos, no editando este número.
          </span>
        </label>
      </div>

      <label class="text-sm font-medium text-slate-700">
        Foto (opcional)
        <input
          type="file"
          accept="image/*"
          class="mt-1 block w-full text-sm text-slate-600"
          :disabled="isPending"
          @change="imagen = ($event.target as HTMLInputElement).files?.[0] ?? null"
        />
      </label>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <NxButton variant="ghost" :disabled="isPending" @click="emit('close')">Cancelar</NxButton>
        <NxButton
          :loading="isPending"
          :disabled="!nombre.trim() || precio === null || isPending"
          @click="submit"
        >
          Guardar
        </NxButton>
      </div>
    </div>
  </NxModal>
</template>
