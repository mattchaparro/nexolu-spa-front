<script setup lang="ts">
import type { PublicService } from '../composables/usePublicBooking'

/*
|------------------------------------------------------------------------------
| El detalle de un servicio, cuando alguien lo pide
|------------------------------------------------------------------------------
| Las descripciones de Luxury promedian 169 caracteres y llegan a 393. Cuarenta
| servicios así son ocho pantallas de teléfono de puro texto, y quien reserva
| no está leyendo: está buscando el suyo.
|
| Así que en la lista va recortada y completa acá. Ojo con el orden de lo que
| se muestra: quien abre esto ya sabe cómo se llama el servicio — lo que viene a
| resolver es "¿es este el que quiero?" y "¿cuánto me vale?".
|
| Se abre desde una hoja pegada abajo y no desde un modal centrado: el pulgar
| llega al borde inferior de un teléfono, no al medio de la pantalla.
*/

defineProps<{ service: PublicService; currency?: string }>()

const emit = defineEmits<{ close: []; book: [id: number] }>()

function money(value: number, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-slate-900/50" @click="emit('close')" />

    <!-- `max-h` y scroll propio: una descripción larga no puede empujar el
         botón de reservar fuera de la pantalla. -->
    <div
      class="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:mb-6 sm:rounded-2xl"
    >
      <div class="flex items-start gap-3 border-b border-slate-100 p-4">
        <h3 class="min-w-0 flex-1 text-base font-semibold text-slate-900">{{ service.name }}</h3>
        <button
          type="button"
          class="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-slate-400 active:bg-slate-100"
          aria-label="Cerrar"
          @click="emit('close')"
        >
          ×
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <img
          v-if="service.image_url"
          :src="service.image_url"
          :alt="service.name"
          class="mb-3 h-40 w-full rounded-xl object-cover"
        />

        <p class="text-sm text-slate-800">
          <b>{{ money(service.price, currency) }}</b>
          <span class="text-slate-500"> · {{ service.duration_min }} min</span>
        </p>

        <p v-if="service.description" class="mt-3 whitespace-pre-line text-sm text-slate-600">
          {{ service.description }}
        </p>
      </div>

      <!-- El botón, siempre visible y con sitio para el borde del iPhone. -->
      <div
        class="border-t border-slate-100 p-4"
        :style="{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }"
      >
        <button
          type="button"
          class="min-h-12 w-full rounded-xl bg-slate-900 px-4 font-medium text-white active:bg-slate-700"
          @click="emit('book', service.id)"
        >
          Reservar este
        </button>
      </div>
    </div>
  </div>
</template>
