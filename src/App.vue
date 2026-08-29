<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppLayout from '@/layouts/AppLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useSystemAlert } from '@/composables/useSystemAlert'
import { useFlashStore } from '@/stores/flash.store'
import { NxToast } from '@/ui'

const route = useRoute()

// El layout se declara en la meta de cada ruta: 'auth' para el login,
// 'blank' para la reserva publica (sin sesion ni menu), y el layout de la
// app para todo lo demas.
const layout = computed(() => {
  if (route.meta.layout === 'auth') return AuthLayout
  if (route.meta.layout === 'blank') return null
  return AppLayout
})

// Puente para mensajes disparados fuera de un componente: el guard del
// router y el interceptor de axios.
const flash = useFlashStore()
const { notify } = useSystemAlert()

watch(
  () => flash.message,
  (message) => {
    if (message) {
      notify(message, flash.severity)
      flash.clear()
    }
  },
)
</script>

<template>
  <component :is="layout" v-if="layout">
    <RouterView />
  </component>
  <RouterView v-else />
  <NxToast />
</template>
