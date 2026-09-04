<script setup lang="ts">
import { ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { NxButton, NxModal } from '@/ui'
import { extractErrorMessage } from '@/utils/extractErrorMessage'

import { useWorkPhoto, type PendingService } from '../composables/useMyWork'

/**
 * La foto del trabajo recién hecho.
 *
 * Vive acá y no sólo en el cobro porque en muchos spas quien cobra es
 * recepción: si la única puerta fuera el checkout, la profesional que no
 * cobra nunca subiría una foto.
 *
 * SIN RETOQUE de por medio. Esta imagen es la evidencia de cómo quedó el
 * trabajo —lo que se mira para evaluarlo y lo que ella misma consulta la
 * próxima vez— y una versión embellecida no sirve para ninguna de las dos.
 * Embellecer es una decisión aparte, sobre una copia, y sólo si esa foto
 * llega a una publicación.
 */
const props = defineProps<{ pending: PendingService | null }>()

const emit = defineEmits<{ close: [] }>()

const { notify } = useSystemAlert()
const { mutateAsync: upload, isPending } = useWorkPhoto()

const file = ref<File | null>(null)

/*
 * El permiso arranca APAGADO en cada foto y no recuerda la respuesta
 * anterior: es de la clienta que está enfrente ahora, no una preferencia del
 * negocio. Una casilla que se queda marcada convierte un permiso en un
 * default, que es justo lo que no puede ser.
 */
const consent = ref(false)

watch(
  () => props.pending,
  () => {
    file.value = null
    consent.value = false
  },
)

function onFile(event: Event): void {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function guardar(): Promise<void> {
  if (!props.pending || !file.value) return

  try {
    await upload({
      appointmentId: props.pending.id,
      file: file.value,
      marketingConsent: consent.value,
    })

    notify('Foto guardada.', 'success')
    emit('close')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos guardar la foto.'), 'error')
  }
}
</script>

<template>
  <NxModal
    :model-value="pending !== null"
    size="sm"
    title="Foto del trabajo"
    @update:model-value="emit('close')"
  >
    <div v-if="pending" class="flex flex-col gap-4">
      <p class="text-sm text-slate-600">{{ pending.service_name }} de {{ pending.client_name }}.</p>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        class="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
        :disabled="isPending"
        @change="onFile"
      />

      <!--
        El mejor momento para preguntarlo es este: la clienta acaba de
        levantarse de la silla y está ahí mirándose las manos. Buscarla dos
        semanas después, cuando alguien arma el calendario de publicaciones,
        es como se termina publicando sin preguntar.
      -->
      <label class="flex items-start gap-2 text-sm text-slate-600">
        <input v-model="consent" type="checkbox" class="mt-0.5 size-4" :disabled="isPending" />
        <span>
          La clienta me dio permiso de publicarla
          <span class="block text-xs text-slate-400">
            Sin esto la foto queda en su ficha, pero no se puede usar en las redes.
          </span>
        </span>
      </label>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <NxButton variant="secondary" :disabled="isPending" @click="emit('close')">
          Cerrar
        </NxButton>
        <NxButton :loading="isPending" :disabled="!file || isPending" @click="guardar">
          Guardar
        </NxButton>
      </div>
    </template>
  </NxModal>
</template>
