<script setup lang="ts">
/**
 * La pantalla de paso entre el sistema viejo y este.
 *
 * Quien entró por `luxurynails.com.co` llega acá con un pase en la URL, y
 * lo único que hace esta vista es canjearlo y seguir. No tiene formulario ni
 * botones: si funciona, la persona ni alcanza a leerla; si no, le dice qué
 * pasó y le ofrece la puerta normal.
 *
 * El pase se gasta al canjearse, así que recargar esta pantalla NO
 * reintenta -- y está bien que no lo haga: reintentar con un pase gastado
 * solo daría el mismo error dos veces.
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth.store'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const error = ref<string | null>(null)

onMounted(async () => {
  const ticket = String(route.params.ticket ?? '')

  if (!ticket) {
    error.value = 'El enlace llegó incompleto.'

    return
  }

  try {
    await auth.redeemLegacyTicket(ticket)

    // El mismo destino que el canje de nexolu-auth: plataforma a lo suyo,
    // negocio a la agenda, que es donde el salón vive todo el día.
    await router.replace(auth.isSuperAdmin ? { name: 'sa-dashboard' } : { name: 'agenda' })
  } catch {
    /*
     * Un solo mensaje para todos los casos a propósito. Desde acá, "el pase
     * venció", "ya se usó" y "la cuenta está desactivada" se resuelven
     * igual: volver a entrar. Distinguirlos solo le daría a la persona
     * información que no puede usar.
     */
    error.value = 'Este acceso ya venció. Vuelve a iniciar sesión.'
  }
})
</script>

<template>
  <div class="grid min-h-dvh place-items-center px-4">
    <div v-if="error" class="max-w-sm text-center">
      <p class="text-lg font-medium">{{ error }}</p>

      <RouterLink
        :to="{ name: 'login' }"
        class="mt-4 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-white"
      >
        Iniciar sesión
      </RouterLink>
    </div>

    <p v-else class="text-slate-500">Entrando…</p>
  </div>
</template>
