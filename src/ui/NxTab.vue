<script setup lang="ts">
import PrimeTab from 'primevue/tab'

withDefaults(
  defineProps<{
    value: string | number
    /** PrimeIcon (ej. "pi pi-wallet") a la izquierda del texto de la pestaña. */
    icon?: string
    disabled?: boolean
  }>(),
  { icon: undefined, disabled: false },
)
</script>

<template>
  <PrimeTab :value="value" :disabled="disabled" as="button" class="flex items-center gap-1.5">
    <i v-if="icon" :class="icon" class="text-sm" />
    <slot />
  </PrimeTab>
</template>
