<script setup lang="ts">
import { computed, ref } from 'vue'

import { usePublishablePhotos } from '../composables/useSocialPosts'

/**
 * De dónde sale la imagen de una publicación.
 *
 * Dos orígenes y una diferencia que importa:
 *
 * - **Las fotos de la ficha** son de una clienta, y sólo aparecen acá las que
 *   ella autorizó. El servidor filtra por consentimiento y no acepta ningún
 *   parámetro para saltárselo — esta lista es literalmente todo lo que se
 *   puede usar. Tampoco trae su nombre: quien arma la publicación no lo
 *   necesita.
 * - **Una imagen suelta** —la vitrina, el equipo, un flyer— no es de nadie y
 *   no necesita permiso.
 *
 * El texto que acompaña al listado vacío no dice "no hay fotos": dice que
 * falta pedir el permiso, que es lo accionable. «No hay fotos» manda a la
 * persona a buscar un problema que no existe.
 */
const props = defineProps<{
  /** La foto de la ficha ya elegida, si hay. */
  clientPhotoId: number | null
  /** Lo que se ve ahora: una foto de la ficha, una subida, o nada. */
  currentUrl: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'pick-photo': [id: number]
  'pick-file': [file: File]
  clear: []
}>()

const abierto = ref(false)

const { data: photos, isLoading } = usePublishablePhotos(abierto)

const disponibles = computed(() => photos.value ?? [])

function onFile(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  emit('pick-file', file)
  ;(event.target as HTMLInputElement).value = ''
}
</script>

<template>
  <div>
    <div
      v-if="props.currentUrl"
      class="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
    >
      <img :src="props.currentUrl" alt="" class="max-h-56 w-full object-cover" />
      <button
        v-if="!props.disabled"
        type="button"
        class="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs text-slate-600"
        @click="emit('clear')"
      >
        Quitar
      </button>
    </div>

    <p
      v-else
      class="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500"
    >
      Sin imagen. En Instagram, una publicación sin foto no es una publicación.
    </p>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
        :disabled="props.disabled"
        @click="abierto = !abierto"
      >
        {{ abierto ? 'Cerrar fotos de clientas' : 'Elegir foto de una clienta' }}
      </button>

      <label class="text-sm text-slate-600">
        <span class="sr-only">Subir una imagen</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
          :disabled="props.disabled"
          @change="onFile"
        />
      </label>
    </div>

    <div v-if="abierto" class="mt-3">
      <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

      <p
        v-else-if="!disponibles.length"
        class="rounded-lg bg-amber-50 px-4 py-5 text-sm text-amber-900"
      >
        Todavía no hay fotos autorizadas. El permiso se pide en la ficha de la clienta, al subir la
        foto — es el momento en que ella está ahí para decir que sí.
      </p>

      <div v-else class="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
        <button
          v-for="foto in disponibles"
          :key="foto.id"
          type="button"
          class="overflow-hidden rounded-md border-2 text-left transition"
          :class="
            props.clientPhotoId === foto.id
              ? 'border-slate-800'
              : 'border-transparent hover:border-slate-300'
          "
          :disabled="props.disabled"
          @click="emit('pick-photo', foto.id)"
        >
          <img :src="foto.url" alt="" class="h-24 w-full object-cover" />
          <span class="block px-1.5 py-1 text-[11px] text-slate-500">
            {{ foto.service_name ?? 'Trabajo' }} · {{ foto.date }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
