<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  usePublishablePhotos,
  type PostImage,
  type PublishablePhoto,
} from '../composables/useSocialPosts'

/**
 * Las imágenes de una publicación, en orden.
 *
 * LA PRIMERA ES LA PORTADA: la única que se ve en la cuadrícula del perfil, y
 * la que decide si alguien abre la publicación. Por eso se puede mover, y por
 * eso la pantalla no reordena por su cuenta.
 *
 * LO QUE SE AGREGA VA AL FINAL, y se ve así antes de guardar. Es a propósito:
 * el servidor agrega las nuevas después de las que ya estaban, y una pantalla
 * que dejara arrastrar una foto nueva al primer puesto estaría prometiendo un
 * orden que no va a ocurrir. Se guarda, y ahí ya se mueve como todas.
 *
 * DE DÓNDE SALEN, y la diferencia importa: las fotos de la ficha son de una
 * clienta y sólo aparecen acá las que ella autorizó —el servidor filtra por
 * consentimiento y no acepta parámetro para saltárselo—; una imagen suelta
 * (la vitrina, el equipo, un flyer) no es de nadie.
 */
const props = defineProps<{
  /** Las que ya están guardadas, en orden. */
  images: PostImage[]
  disabled?: boolean
}>()

/*
 * El plan de imágenes que la vista va a mandar al guardar. Vive acá y se
 * emite hacia arriba en vez de que el editor lo arme: es una sola decisión
 * -"cómo queda el carrusel"- y partirla en dos sitios es como se
 * desincronizan.
 */
const keep = defineModel<number[]>('keep', { required: true })
const newPhotos = defineModel<number[]>('photos', { required: true })
const newFiles = defineModel<File[]>('files', { required: true })

const abierto = ref(false)
const { data: pool, isLoading } = usePublishablePhotos(abierto)

/** Las guardadas que siguen, en el orden elegido. */
const conservadas = computed(() =>
  keep.value.map((id) => props.images.find((i) => i.id === id)).filter((i): i is PostImage => !!i),
)

const poolPorId = computed(() => new Map((pool.value ?? []).map((p) => [p.id, p])))

const fotosNuevas = computed(() =>
  newPhotos.value
    .map((id) => poolPorId.value.get(id))
    .filter((p): p is PublishablePhoto => p !== undefined),
)

/*
 * Las vistas previas de los archivos se revocan al cambiar y al desmontar: un
 * objectURL que nadie libera es memoria retenida mientras la pestaña viva, y
 * en esta pantalla se prueban muchas fotos seguidas.
 */
const previas = ref<string[]>([])

watch(
  newFiles,
  (files) => {
    previas.value.forEach((url) => URL.revokeObjectURL(url))
    previas.value = files.map((f) => URL.createObjectURL(f))
  },
  { deep: true, immediate: true },
)

onBeforeUnmount(() => previas.value.forEach((url) => URL.revokeObjectURL(url)))

const total = computed(
  () => conservadas.value.length + fotosNuevas.value.length + newFiles.value.length,
)

/** El tope de Instagram: con más, rechaza la publicación entera. */
const MAX = 10
const lleno = computed(() => total.value >= MAX)

function mover(index: number, delta: number): void {
  const destino = index + delta
  if (destino < 0 || destino >= keep.value.length) return

  const copia = [...keep.value]
  ;[copia[index], copia[destino]] = [copia[destino], copia[index]]
  keep.value = copia
}

function quitar(id: number): void {
  keep.value = keep.value.filter((x) => x !== id)
}

function alternarFoto(id: number): void {
  if (newPhotos.value.includes(id)) {
    newPhotos.value = newPhotos.value.filter((x) => x !== id)

    return
  }

  if (lleno.value) return

  newPhotos.value = [...newPhotos.value, id]
}

function onFiles(event: Event): void {
  const elegidos = Array.from((event.target as HTMLInputElement).files ?? [])
  const caben = Math.max(0, MAX - total.value)

  newFiles.value = [...newFiles.value, ...elegidos.slice(0, caben)]
  ;(event.target as HTMLInputElement).value = ''
}

function quitarArchivo(index: number): void {
  newFiles.value = newFiles.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div>
    <p
      v-if="!total"
      class="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500"
    >
      Sin imágenes. En Instagram, una publicación sin foto no es una publicación.
    </p>

    <div v-else class="flex flex-wrap gap-2">
      <!-- Las guardadas: éstas sí se mueven. La primera es la portada. -->
      <figure
        v-for="(image, index) in conservadas"
        :key="image.id"
        class="relative w-24 overflow-hidden rounded-md border border-slate-200"
      >
        <img v-if="image.url" :src="image.url" alt="" class="h-24 w-full object-cover" />
        <div
          v-else
          class="flex h-24 items-center justify-center bg-slate-100 px-1 text-center text-[10px] text-slate-500"
        >
          La foto ya no está
        </div>

        <span
          v-if="index === 0"
          class="absolute left-1 top-1 rounded bg-slate-900/75 px-1 text-[10px] text-white"
        >
          Portada
        </span>

        <figcaption v-if="!props.disabled" class="flex items-center justify-between px-1 py-0.5">
          <button
            type="button"
            class="px-1 text-xs text-slate-500"
            :disabled="index === 0"
            @click="mover(index, -1)"
          >
            ←
          </button>
          <button
            type="button"
            class="px-1 text-xs text-slate-400 hover:text-red-600"
            @click="quitar(image.id)"
          >
            Quitar
          </button>
          <button
            type="button"
            class="px-1 text-xs text-slate-500"
            :disabled="index === conservadas.length - 1"
            @click="mover(index, 1)"
          >
            →
          </button>
        </figcaption>
      </figure>

      <!-- Lo nuevo va al final hasta que se guarde. -->
      <figure
        v-for="foto in fotosNuevas"
        :key="`nueva-${foto.id}`"
        class="relative w-24 overflow-hidden rounded-md border-2 border-dashed border-indigo-300"
      >
        <img :src="foto.url" alt="" class="h-24 w-full object-cover" />
        <button
          type="button"
          class="w-full px-1 py-0.5 text-[11px] text-slate-400 hover:text-red-600"
          :disabled="props.disabled"
          @click="alternarFoto(foto.id)"
        >
          Quitar
        </button>
      </figure>

      <figure
        v-for="(url, index) in previas"
        :key="`archivo-${index}`"
        class="relative w-24 overflow-hidden rounded-md border-2 border-dashed border-indigo-300"
      >
        <img :src="url" alt="" class="h-24 w-full object-cover" />
        <button
          type="button"
          class="w-full px-1 py-0.5 text-[11px] text-slate-400 hover:text-red-600"
          :disabled="props.disabled"
          @click="quitarArchivo(index)"
        >
          Quitar
        </button>
      </figure>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
        :disabled="props.disabled"
        @click="abierto = !abierto"
      >
        {{ abierto ? 'Cerrar fotos de clientas' : 'Agregar foto de una clienta' }}
      </button>

      <label class="text-sm text-slate-600">
        <span class="sr-only">Subir imágenes</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          class="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
          :disabled="props.disabled || lleno"
          @change="onFiles"
        />
      </label>

      <span class="text-xs text-slate-400">{{ total }} de {{ MAX }}</span>
    </div>

    <div v-if="abierto" class="mt-3">
      <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

      <p
        v-else-if="!(pool ?? []).length"
        class="rounded-lg bg-amber-50 px-4 py-5 text-sm text-amber-900"
      >
        Todavía no hay fotos autorizadas. El permiso se pide en la ficha de la clienta, al subir la
        foto — es el momento en que ella está ahí para decir que sí.
      </p>

      <div v-else class="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
        <button
          v-for="foto in pool"
          :key="foto.id"
          type="button"
          class="overflow-hidden rounded-md border-2 text-left transition disabled:opacity-40"
          :class="
            newPhotos.includes(foto.id)
              ? 'border-indigo-500'
              : 'border-transparent hover:border-slate-300'
          "
          :disabled="props.disabled || (lleno && !newPhotos.includes(foto.id))"
          @click="alternarFoto(foto.id)"
        >
          <img :src="foto.url" alt="" class="h-20 w-full object-cover" />
          <span class="block px-1.5 py-1 text-[11px] text-slate-500">
            {{ foto.service_name ?? 'Trabajo' }} · {{ foto.date }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
