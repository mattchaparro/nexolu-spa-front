<script setup lang="ts">
// Alerta flotante de acciones del sistema (PrimeVue Toast, tema propio via
// nexoluPreset) - arriba-centro, breve y no bloqueante ("Producto agregado
// a la venta", etc.). Un solo <NxToast /> montado en App.vue; para
// dispararla desde cualquier pantalla usar useSystemAlert() (ver
// src/composables/useSystemAlert.ts), no `useToast()` de PrimeVue directo
// (ver README "Nexolu UI").
import PrimeToast from 'primevue/toast'
</script>

<template>
  <PrimeToast position="top-center" :pt="{ root: { class: 'w-[92vw] max-w-sm' } }" />
</template>
