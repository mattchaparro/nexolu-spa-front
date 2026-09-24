<script setup lang="ts">
/*
 * El chat de WhatsApp del salón vive en Nexolú Connect.
 *
 * Aquí hubo dos bandejas: una propia (`InboxView`) y la de Connect metida
 * en un iframe. Las dos se quedaban atrás de Connect, y desde un iframe
 * el navegador no deja pedir permiso para avisar al celular. Así que el
 * chat se abre en Connect, con la persona ya adentro como usuaria de SU
 * salón, y Connect le avisa al celular cada vez que alguien escribe.
 *
 * La URL trae un pase de un solo uso que vence en dos minutos: se pide en
 * el momento del clic, nunca antes.
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'

import { useNavBadges } from '@/composables/useNavBadges'
import { httpClient } from '@/services/http/client'

const opening = ref(false)
const error = ref<string | null>(null)

const { badge } = useNavBadges()
const unread = computed(() => badge('inbox_unread'))

async function openChat(): Promise<void> {
  error.value = null
  opening.value = true
  /*
   * La pestaña se abre YA, dentro del clic, y después se le pone la
   * dirección: si se abriera después de esperar al servidor, el navegador
   * (Safari sobre todo) la bloquearía como ventana emergente.
   */
  const tab = window.open('', '_blank')
  try {
    const { data } = await httpClient.post<{ url: string }>('/whatsapp/connect-link')
    if (tab) tab.location.href = data.url
    else window.location.href = data.url
  } catch {
    tab?.close()
    error.value = 'El chat no está disponible en este momento. Intenta de nuevo en un rato.'
  } finally {
    opening.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-start gap-4">
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
        >
          <i class="pi pi-comments text-xl" />
        </span>
        <div class="min-w-0">
          <h1 class="text-lg font-semibold text-slate-900">WhatsApp</h1>
          <p class="mt-1 text-sm text-slate-600">
            Las conversaciones con tus clientas se atienden en Nexolú Connect: ahí ves lo que
            escriben, lo que contesta el bot y respondes tú.
          </p>
          <p v-if="unread > 0" class="mt-3 text-sm font-medium text-emerald-700">
            {{ unread === 1 ? '1 conversación espera' : `${unread} conversaciones esperan` }}
            respuesta.
          </p>
        </div>
      </div>

      <Button
        class="mt-5 w-full"
        label="Abrir el chat"
        icon="pi pi-external-link"
        icon-pos="right"
        :loading="opening"
        @click="openChat"
      />
      <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
      <h2 class="font-medium text-slate-800">
        <i class="pi pi-bell mr-1 text-emerald-600" /> Que te avise al celular
      </h2>
      <ul class="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          Abre el chat desde el celular y toca la campana de arriba → «Activar avisos». Te
          llega uno cada vez que una clienta escribe, aunque tengas Connect cerrado.
        </li>
        <li>
          En <strong>iPhone</strong> primero instálalo: en Safari toca Compartir → «Añadir a
          pantalla de inicio», ábrelo desde ese ícono y activa los avisos ahí.
        </li>
        <li>Al cerrar sesión en Connect los avisos se apagan en ese celular.</li>
      </ul>
    </div>
  </div>
</template>
