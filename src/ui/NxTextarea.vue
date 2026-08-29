<script setup lang="ts">
// Version multilinea de NxInput - mismo estandar de Float Label "on", para
// texto largo (descripcion, instrucciones de uso, etc.) en vez de forzar
// un NxInput de una sola linea.
import { computed, useId } from 'vue'
import PrimeFloatLabel from 'primevue/floatlabel'
import PrimeMessage from 'primevue/message'
import PrimeTextarea from 'primevue/textarea'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    label?: string
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    error?: string
    required?: boolean
    id?: string
    rows?: number
  }>(),
  {
    modelValue: '',
    label: undefined,
    placeholder: undefined,
    disabled: false,
    invalid: false,
    error: undefined,
    required: false,
    id: undefined,
    rows: 3,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const generatedId = useId()
const inputId = computed(() => props.id ?? generatedId)
const isInvalid = computed(() => props.invalid || Boolean(props.error))
const effectivePlaceholder = computed(() => (props.label ? undefined : props.placeholder))
</script>

<template>
  <div class="flex flex-col gap-1">
    <PrimeFloatLabel variant="on">
      <PrimeTextarea
        :id="inputId"
        :model-value="modelValue"
        :placeholder="effectivePlaceholder"
        :disabled="disabled"
        :invalid="isInvalid"
        :rows="rows"
        style="font-size: 16px"
        fluid
        @update:model-value="(value) => emit('update:modelValue', value as string)"
      />
      <label v-if="label" :for="inputId">{{ label }}<span v-if="required" class="text-red-600"> *</span></label>
    </PrimeFloatLabel>
    <PrimeMessage v-if="error" severity="error" size="small" variant="simple">{{ error }}</PrimeMessage>
  </div>
</template>
