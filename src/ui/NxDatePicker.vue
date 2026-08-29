<script setup lang="ts">
// Selector de fecha - reemplaza <NxInput type="date"> (input nativo del
// navegador) por primevue/datepicker, con el mismo patron de FloatLabel/size
// que NxInput/NxSelect (ver esos dos para la referencia del patron).
import { computed, useId } from 'vue'
import PrimeDatePicker from 'primevue/datepicker'
import PrimeFloatLabel from 'primevue/floatlabel'
import PrimeMessage from 'primevue/message'

import type { NxInputSize } from './NxInput.vue'

const props = withDefaults(
  defineProps<{
    // String ISO 'YYYY-MM-DD' (o 'YYYY-MM' con view="month") - no Date, para
    // no tener que tocar los refs/composables existentes en todo el repo que
    // ya trabajan con toLocalDateIso() (dateFrom, dateTo, etc.).
    modelValue?: string | null
    label?: string
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    error?: string
    required?: boolean
    size?: NxInputSize
    id?: string
    /** Igual que primevue/datepicker: 'date' (default), 'month' o 'year'. */
    view?: 'date' | 'month' | 'year'
    /** Formato de despliegue - por defecto dd/mm/yy (convencion CO). En view="month" usar "mm/yy". */
    dateFormat?: string
    /** String ISO 'YYYY-MM-DD' - ej. no permitir cerrar caja a futuro. */
    minDate?: string | null
    maxDate?: string | null
  }>(),
  {
    modelValue: null,
    label: undefined,
    placeholder: undefined,
    disabled: false,
    invalid: false,
    error: undefined,
    required: false,
    size: 'md',
    id: undefined,
    view: 'date',
    dateFormat: 'dd/mm/yy',
    minDate: undefined,
    maxDate: undefined,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const generatedId = useId()
const inputId = computed(() => props.id ?? generatedId)
const isInvalid = computed(() => props.invalid || Boolean(props.error))

const primeSize = computed<'small' | 'large' | undefined>(() => {
  if (props.size === 'sm') {
    return 'small'
  }
  if (props.size === 'lg') {
    return 'large'
  }
  return undefined
})

// Nunca usar toISOString()/parseISO con Date UTC aca: en Bogota (UTC-5)
// eso corre la fecha un dia segun la hora - mismo bug que documenta
// src/utils/toLocalDateIso.ts, aplicado a la conversion string<->Date que
// necesita este wrapper para hablar con primevue/datepicker.
function isoToLocalDate(iso: string | null): Date | null {
  if (!iso) {
    return null
  }
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day || 1)
}

function localDateToIso(date: Date | null): string | null {
  if (!date) {
    return null
  }
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  if (props.view === 'year') {
    return String(year)
  }
  if (props.view === 'month') {
    return `${year}-${month}`
  }
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dateValue = computed(() => isoToLocalDate(props.modelValue ?? null))
const minDateValue = computed(() => isoToLocalDate(props.minDate ?? null) ?? undefined)
const maxDateValue = computed(() => isoToLocalDate(props.maxDate ?? null) ?? undefined)

function handleUpdate(value: Date | Date[] | (Date | null)[] | null | undefined): void {
  emit('update:modelValue', localDateToIso((value as Date | null) ?? null))
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <PrimeFloatLabel variant="on">
      <PrimeDatePicker
        :input-id="inputId"
        :model-value="dateValue"
        :view="view"
        :date-format="dateFormat"
        :min-date="minDateValue"
        :max-date="maxDateValue"
        :placeholder="label ? undefined : placeholder"
        :disabled="disabled"
        :invalid="isInvalid"
        :size="primeSize"
        show-icon
        icon-display="input"
        fluid
        @update:model-value="handleUpdate"
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
