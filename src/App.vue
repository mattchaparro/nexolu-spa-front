<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppLayout from '@/layouts/AppLayout.vue'
import SuperAdminLayout from '@/layouts/SuperAdminLayout.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useSystemAlert } from '@/composables/useSystemAlert'
import { useFlashStore } from '@/stores/flash.store'
import { NxToast } from '@/ui'

const route = useRoute()

// El layout se declara en la meta de cada ruta: 'auth' para el login,
// 'blank' para la reserva publica (sin sesion ni menu), y el layout de la
// app para todo lo demas.
const layout = computed(() => {
  /*
   * En una carga en frio la primera navegacion todavia no ha resuelto: `route`
   * es la ruta inicial vacia, sin `matched` y sin `meta`. Caer al layout de
   * negocio en ese instante lo MONTA de verdad -- con su menu y, peor, con los
   * llamados que hace al montarse.
   *
   * Eso fue un bug real: un usuario de plataforma entraba por SSO, AppLayout
   * alcanzaba a pedir `/nav-badges`, el backend respondia 403 porque esa
   * persona no tiene negocio, y el interceptor le mostraba "No tienes permiso
   * para esta accion" ENCIMA del panel de plataforma, que habia cargado bien.
   * El error era de una pantalla que nunca llego a verse.
   */
  if (route.matched.length === 0) return null

  if (route.meta.layout === 'auth') return AuthLayout
  if (route.meta.layout === 'superadmin') return SuperAdminLayout
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
