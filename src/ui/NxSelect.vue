<script setup lang="ts" generic="T extends object">
// Dropdown de opciones con el mismo estandar de Float Label "on" que
// NxInput/NxInputNumber - reemplaza cualquier <select> HTML suelto (ver
// README "Nexolu UI"). Para elegir un medio de pago especifico se usa
// PaymentMethodPicker (botones grandes, mejor para pocas opciones tocadas
// seguido); NxSelect es para listas mas largas o secundarias (descuentos,
// filas repetidas).
import { computed, useId } from 'vue'
import PrimeFloatLabel from 'primevue/floatlabel'
import PrimeMessage from 'primevue/message'
import PrimeSelect from 'primevue/select'

import type { NxInputSize } from './NxInput.vue'

const props = withDefaults(
  defineProps<{
    modelValue: unknown
    options: T[]
    optionLabel: string
    optionValue: string
    label?: string
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    error?: string
    required?: boolean
    size?: NxInputSize
    id?: string
    /** Buscador dentro del dropdown - para listas largas (ej. productos/insumos en una linea de compra). */
    filter?: boolean
    /**
     * Campos que PrimeSelect compara contra lo tipeado, ademas de re-emitir
     * el evento filter (ver abajo). Default [optionLabel] - para listas
     * server-driven que buscan por mas de un campo (ej. ClientPicker.vue
     * busca por nombre/telefono/email), hay que listarlos todos aca:
     * PrimeSelect SIEMPRE filtra el resultado del servidor contra lo
     * tipeado ademas de re-emitirlo (no hay forma de desactivar ese filtro
     * propio) - si options ya viene filtrado por telefono pero filterFields
     * solo mira optionLabel (el nombre), un resultado que matcheo por
     * telefono desaparece del dropdown aunque siga en options.
     */
    filterFields?: string[]
  }>(),
  {
    label: undefined,
    placeholder: undefined,
    disabled: false,
    invalid: false,
    error: undefined,
    required: false,
    size: 'md',
    id: undefined,
    filter: false,
    filterFields: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  /** Texto tipeado en el buscador (filter=true) - para listas server-driven (ej. clientes). */
  filter: [query: string]
}>()

const generatedId = useId()
const inputId = computed(() => props.id ?? generatedId)
const isInvalid = computed(() => props.invalid || Boolean(props.error))

// PrimeSelect solo se marca "filled" (float del label) cuando modelValue no
// es null/undefined - pero varios selects de la app usan null a proposito
// como una opcion real con texto visible (ej. { id: null, name: 'Sin
// proveedor' } en PurchaseFormView), asi que Prime muestra ese texto sin
// flotar el label, y quedan superpuestos ("dos campos en uno"). Si el
// modelValue actual matchea alguna opcion de la lista (null incluido), hay
// texto real dibujado en el campo -> forzar la misma clase que Prime usa
// para flotar el label (.p-inputwrapper-filled, ver FloatLabel CSS).
const hasMatchingOption = computed(() =>
  props.options.some(
    (option) => (option as Record<string, unknown>)[props.optionValue] === props.modelValue,
  ),
)

const primeSize = computed<'small' | 'large' | undefined>(() => {
  if (props.size === 'sm') {
    return 'small'
  }
  if (props.size === 'lg') {
    return 'large'
  }
  return undefined
})

const fontSizeStyle = { fontSize: '16px' }
</script>

<template>
  <div class="flex flex-col gap-1">
    <PrimeFloatLabel variant="on">
      <PrimeSelect
        :input-id="inputId"
        :model-value="modelValue"
        :options="options"
        :option-label="optionLabel"
        :option-value="optionValue"
        :disabled="disabled"
        :invalid="isInvalid"
        :size="primeSize"
        :style="fontSizeStyle"
        :filter="filter"
        :filter-fields="filterFields ?? [optionLabel]"
        :class="{ 'p-inputwrapper-filled': hasMatchingOption }"
        fluid
        @update:model-value="(value) => emit('update:modelValue', value)"
        @filter="(event: { value: string }) => emit('filter', event.value)"
      />
      <label v-if="label" :for="inputId"
        >{{ label }}<span v-if="required" class="text-red-600"> *</span></label
      >
    </PrimeFloatLabel>
    <PrimeMessage v-if="error" severity="error" size="small" variant="simple">{{
      error
    }}</PrimeMessage>
  </div>
</template>
