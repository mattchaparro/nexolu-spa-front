<script setup lang="ts">
/*
 * Enlaces wa.me: un toque y se abre WhatsApp con tu número y el mensaje ya
 * escrito. Para pegar en el Instagram, en un anuncio, en una historia o en un
 * código QR; el que escribe no tiene que buscar el contacto ni redactar nada.
 *
 * Es el reemplazo de los «enlaces de ManyChat»: el mensaje de arranque dice
 * qué quiere, y el asistente lo toma desde ahí.
 */
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { NxButton } from '@/ui'

const props = defineProps<{
  /** El número de WhatsApp del negocio, como esté escrito. */
  number: string
  services: Array<{ id: number; name: string }>
}>()

const { notify } = useSystemAlert()

/** `null` es «cualquier cosa»: el saludo para agendar, sin servicio. */
const serviceId = ref<number | null>(null)
const message = ref('')

const GENERAL = 'Hola, quiero agendar una cita 💅'

function defaultMessage(): string {
  const service = props.services.find((s) => s.id === serviceId.value)
  return service ? `Hola, quiero agendar ${service.name} 💅` : GENERAL
}

watch(serviceId, () => (message.value = defaultMessage()), { immediate: true })

/**
 * Solo dígitos, con el indicativo del país.
 *
 * wa.me no acepta «+», espacios ni guiones, y sin el 57 un celular colombiano
 * (10 dígitos, empieza por 3) abre un chat con un número que no existe.
 */
const digits = computed(() => {
  const only = props.number.replace(/\D/g, '')
  return only.length === 10 && only.startsWith('3') ? `57${only}` : only
})

const link = computed(() =>
  digits.value
    ? `https://wa.me/${digits.value}?text=${encodeURIComponent(message.value.trim())}`
    : '',
)

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(link.value)
    notify('Enlace copiado.', 'success')
  } catch {
    notify('Copia el enlace a mano: está a la vista.', 'warn')
  }
}
</script>

<template>
  <div class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
    <h2 class="text-sm font-medium text-slate-800">💬 Enlaces de WhatsApp</h2>
    <p class="mt-1 text-xs text-slate-600">
      Pégalos en tu Instagram, en un anuncio o en una historia: al tocarlos se abre tu WhatsApp con
      el mensaje ya escrito. Usan el número del campo «WhatsApp» de más abajo.
    </p>

    <p
      v-if="!digits"
      class="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
      data-testid="wa-links-missing-number"
    >
      Primero escribe tu número de WhatsApp en el campo de más abajo y guarda la página.
    </p>

    <div v-else class="mt-3 flex flex-col gap-3">
      <label class="text-sm text-slate-700">
        ¿Para qué es?
        <select
          v-model="serviceId"
          class="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-800"
          data-testid="wa-links-service"
        >
          <option :value="null">Cualquier cosa (agendar una cita)</option>
          <option v-for="s in services" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </label>

      <label class="text-sm text-slate-700">
        Mensaje con el que llega
        <textarea
          v-model="message"
          rows="2"
          maxlength="300"
          class="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-800"
          data-testid="wa-links-message"
        />
      </label>

      <div>
        <p class="text-xs uppercase tracking-wide text-emerald-600">Tu enlace</p>
        <p class="mt-1 break-all font-mono text-sm text-emerald-900" data-testid="wa-links-url">
          {{ link }}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <NxButton size="sm" @click="copy">Copiar enlace</NxButton>
          <a
            :href="link"
            target="_blank"
            rel="noopener"
            class="rounded-md border border-emerald-300 px-3 py-1.5 text-sm text-emerald-800"
          >
            Probarlo
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
