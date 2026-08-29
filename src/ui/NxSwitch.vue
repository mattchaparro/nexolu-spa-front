<script setup lang="ts">
// Interruptor compacto (sin icono/label propios, a diferencia de
// NxToggleButton) para filas de lista tipo "feature on/off" - una tabla de
// varios flags no cabe bien con un boton de ancho completo por fila.
import PrimeToggleSwitch from 'primevue/toggleswitch'

defineProps<{
  modelValue: boolean
  disabled?: boolean
}>()

defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <PrimeToggleSwitch :model-value="modelValue" :disabled="disabled" @update:model-value="$emit('update:modelValue', $event)" />
</template>
