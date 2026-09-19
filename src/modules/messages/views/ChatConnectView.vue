<script setup lang="ts">
/*
 * La bandeja de Connect, dentro de este panel.
 *
 * Por qué no está escrita acá. Lo estuvo: `InboxView.vue` es la versión
 * propia, y se quedó atrás. Connect tiene búsqueda que ignora tildes,
 * plantillas, adjuntos, la ficha de la clienta con notas y etiquetas,
 * respuestas rápidas y asignación — y cada una de esas habría que
 * escribirla otra vez acá para que el salón las tenga. Con dos apps ya
 * duele; con las que vienen, no se sostiene.
 *
 * Así que la pantalla es la de Connect y esta vista solo la sostiene: le
 * pide la llave a nuestro backend (que la cambia por la suya, de servidor
 * a servidor) y la renueva antes de que caduque, porque quien atiende
 * deja esto abierto toda la tarde.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { httpClient } from '@/services/http/client'

interface Credencial {
  token: string
  expires_at: string | null
  url: string
}

const src = ref<string | null>(null)
const error = ref<string | null>(null)
const marco = ref<HTMLIFrameElement | null>(null)

let origenDelChat: string | null = null
let renovacion: ReturnType<typeof setTimeout> | null = null

async function pedirCredencial(): Promise<Credencial | null> {
  try {
    const { data } = await httpClient.get<Credencial>('/whatsapp/chat-embebido/token')
    return data
  } catch {
    error.value = 'El chat no está disponible en este momento.'
    return null
  }
}

/**
 * Cuándo volver a pedirla.
 *
 * Un minuto antes de que caduque, y nunca menos de treinta segundos: si
 * el reloj del navegador va adelantado respecto al del servidor, un
 * cálculo ingenuo pediría una llave nueva en bucle.
 */
function cuandoRenovar(expiraEn: string | null): number {
  if (!expiraEn) return 10 * 60 * 1000

  const faltan = new Date(expiraEn).getTime() - Date.now() - 60_000
  return Math.max(30_000, faltan)
}

async function renovar(): Promise<void> {
  const credencial = await pedirCredencial()
  if (!credencial) return

  /*
   * La llave nueva va por `postMessage` y no recargando el iframe: quien
   * está contestando no puede perder lo que lleva escrito cada quince
   * minutos. Y va SOLO al origen del chat, nunca a `*` -- mandarla a
   * cualquiera es regalarla.
   */
  if (origenDelChat) {
    marco.value?.contentWindow?.postMessage(
      { tipo: 'nexolu:embed-token', token: credencial.token },
      origenDelChat,
    )
  }

  renovacion = setTimeout(renovar, cuandoRenovar(credencial.expires_at))
}

onMounted(async () => {
  const credencial = await pedirCredencial()
  if (!credencial) return

  origenDelChat = new URL(credencial.url).origin
  src.value = `${credencial.url}?t=${encodeURIComponent(credencial.token)}`
  renovacion = setTimeout(renovar, cuandoRenovar(credencial.expires_at))
})

onBeforeUnmount(() => {
  if (renovacion) clearTimeout(renovacion)
})
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <p v-if="error" class="rounded-lg bg-amber-50 px-4 py-8 text-center text-sm text-amber-800">
      {{ error }}
    </p>

    <iframe
      v-else-if="src"
      ref="marco"
      :src="src"
      class="min-h-0 flex-1 rounded-lg border border-slate-200 bg-white"
      title="Conversaciones de WhatsApp"
      allow="clipboard-write"
    />

    <p v-else class="px-4 py-8 text-center text-sm text-slate-500">Abriendo las conversaciones…</p>
  </section>
</template>
