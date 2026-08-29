<script setup lang="ts">
// Interruptor on/off con icono (ej. cortesia, domicilio) - reemplaza el
// patron de checkbox nativo + <label> a mano que se repetia en varios
// formularios. Selected = indigo (marca), igual que cualquier otro estado
// "activo" de Nexolu UI.
import { computed } from 'vue'
import PrimeToggleButton from 'primevue/togglebutton'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    label: string
    icon: string
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const isChecked = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
</script>

<template>
  <PrimeToggleButton
    v-model="isChecked"
    :on-icon="icon"
    :off-icon="icon"
    :on-label="label"
    :off-label="label"
    :disabled="disabled"
  />
</template>
