<script setup lang="ts">
import PrimeTabPanel from 'primevue/tabpanel'

defineProps<{ value: string | number }>()
</script>

<template>
  <PrimeTabPanel :value="value">
    <slot />
  </PrimeTabPanel>
</template>
