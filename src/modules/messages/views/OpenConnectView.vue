<script setup lang="ts">
/*
 * Entrar a Connect con la cuenta del Spa, sin pasar por el menú.
 *
 * Connect no tiene contraseña para la gente de los salones: le cree al Spa
 * (ver ConnectChatView). Eso obligaba a Alejandra a abrir la agenda, ir a
 * «WhatsApp» y tocar «Abrir el chat» cada vez que la sesión de Connect se
 * vencía. Ahora Connect tiene un botón «Entrar con mi cuenta del Spa» que
 * trae aquí: si ya hay sesión, se pide el pase y se sigue derecho; si no, el
 * router la manda primero al login del Spa -- el mismo correo y la misma
 * contraseña de siempre -- y vuelve aquí solo.
 *
 * En la misma pestaña y no en una nueva: aquí no hay clic que abra una
 * ventana, y el navegador la bloquearía.
 */
import Button from 'primevue/button'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { httpClient } from '@/services/http/client'

const error = ref<string | null>(null)
const opening = ref(false)

async function open(): Promise<void> {
  error.value = null
  opening.value = true

  try {
    const { data } = await httpClient.post<{ url: string }>('/whatsapp/connect-link')
    window.location.replace(data.url)
  } catch {
    error.value = 'El chat no está disponible en este momento. Intenta de nuevo en un rato.'
    opening.value = false
  }
}

onMounted(open)
</script>

<template>
  <div class="mx-auto max-w-md p-6">
    <div class="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <template v-if="!error">
        <i class="pi pi-spin pi-spinner text-2xl text-emerald-600" />
        <p class="mt-3 text-sm text-slate-600">Abriendo el chat de WhatsApp…</p>
      </template>

      <template v-else>
        <p class="text-sm text-red-600">{{ error }}</p>
        <Button class="mt-4 w-full" label="Intentar de nuevo" :loading="opening" @click="open" />
        <RouterLink :to="{ name: 'agenda' }" class="mt-3 block text-sm text-slate-500 hover:underline">
          Ir a la agenda
        </RouterLink>
      </template>
    </div>
  </div>
</template>
