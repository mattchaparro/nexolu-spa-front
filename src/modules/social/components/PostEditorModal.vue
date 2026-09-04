<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useServices } from '@/modules/agenda/composables/useAvailability'
import { NxButton, NxDatePicker, NxInput, NxModal, NxSelect, NxTextarea } from '@/ui'
import { extractErrorMessage } from '@/utils/extractErrorMessage'

import PhotoPicker from './PhotoPicker.vue'
import {
  useComposePost,
  useDiscardPost,
  useMarkPublished,
  useSavePost,
  useSchedulePost,
  type SocialAngle,
  type SocialPost,
} from '../composables/useSocialPosts'

/**
 * Una publicación, abierta.
 *
 * Es donde ocurre lo único que este módulo NO automatiza: una persona lee el
 * texto, mira la foto y decide. Por eso los tres botones del pie no están al
 * mismo nivel — «Programar» es el verbo de esta pantalla, «Ya la publiqué» es
 * lo que se aprieta después de pegarla en Instagram, y descartar es un enlace
 * gris.
 *
 * NO HAY BOTÓN DE PUBLICAR. El sistema no publica: ver docs/publicaciones.md
 * en el API. Lo que hay es «copiar el texto», que es lo que de verdad hace
 * falta para pegarlo.
 */
const props = defineProps<{
  post: SocialPost | null
  angles: SocialAngle[]
}>()

const emit = defineEmits<{ close: [] }>()

const { notify } = useSystemAlert()

const { data: services } = useServices()

const { mutateAsync: save, isPending: saving } = useSavePost()
const { mutateAsync: compose, isPending: composing } = useComposePost()
const { mutateAsync: schedule, isPending: scheduling } = useSchedulePost()
const { mutateAsync: markPublished, isPending: publishing } = useMarkPublished()
const { mutateAsync: discard } = useDiscardPost()

const caption = ref('')
const hashtags = ref('')
const angle = ref('libre')
const serviceId = ref<number | null>(null)
const extra = ref('')

/** Lo que se ve: la subida nueva, o la que ya tenía. */
const preview = ref<string | null>(null)
const pendingFile = ref<File | null>(null)
const clientPhotoId = ref<number | null>(null)

const fecha = ref<string | null>(null)
const hora = ref('10:00')

const abierto = computed(() => props.post !== null)
const editable = computed(() => ['draft', 'scheduled', 'ready'].includes(props.post?.status ?? ''))
const ocupado = computed(
  () => saving.value || composing.value || scheduling.value || publishing.value,
)

/*
 * Las horas a las que un spa publica. Una lista y no un campo de hora libre:
 * lo que se elige acá es "por la mañana" o "a la salida del trabajo", no las
 * 10:37, y un selector cerrado se toca en un gesto desde el celular.
 */
const HORAS_BASE = Array.from({ length: 27 }, (_, i) => {
  const minutos = 8 * 60 + i * 30

  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
})

/**
 * La lista SIEMPRE incluye la hora que la publicación ya tiene.
 *
 * Sin esto, una programada a las 23:09 —o a cualquier hora fuera de la
 * franja, que es justo lo que pasa con las que devolvió el reloj— abre el
 * selector en blanco, y guardar mandaría una hora vacía. El síntoma es
 * silencioso: la persona ve un campo sin llenar que ella no vació.
 */
const horas = computed(() => {
  const valores = HORAS_BASE.includes(hora.value) ? HORAS_BASE : [...HORAS_BASE, hora.value].sort()

  return valores.map((valor) => ({ value: valor, label: valor }))
})

watch(
  () => props.post,
  (post) => {
    if (!post) return

    caption.value = post.caption ?? ''
    hashtags.value = post.hashtags.join(' ')
    angle.value = post.angle
    serviceId.value = null
    extra.value = ''
    pendingFile.value = null
    preview.value = post.image_url
    clientPhotoId.value = null

    const cuando = post.scheduled_for ? new Date(post.scheduled_for) : null

    fecha.value = cuando ? toIsoDate(cuando) : toIsoDate(new Date())
    hora.value = cuando
      ? `${String(cuando.getHours()).padStart(2, '0')}:${String(cuando.getMinutes()).padStart(2, '0')}`
      : '10:00'
  },
  { immediate: true },
)

function toIsoDate(date: Date): string {
  // Local y no `toISOString()`: en Bogotá esa conversión pasa a UTC y a las
  // 7pm devuelve el día siguiente.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Las etiquetas escritas a mano, normalizadas para mandarlas. */
function tagList(): string[] {
  return hashtags.value
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t !== '' && t !== '#')
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
}

async function guardar(): Promise<SocialPost | null> {
  if (!props.post) return null

  try {
    return await save({
      id: props.post.id,
      caption: caption.value,
      hashtags: tagList(),
      angle: angle.value,
      ...(serviceId.value !== null ? { service_id: serviceId.value } : {}),
      ...(clientPhotoId.value !== null ? { client_photo_id: clientPhotoId.value } : {}),
      ...(pendingFile.value ? { image: pendingFile.value } : {}),
    })
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos guardarla.'), 'error')

    return null
  }
}

async function guardarYCerrar(): Promise<void> {
  if (await guardar()) {
    notify('Guardada.', 'success')
    emit('close')
  }
}

async function escribir(): Promise<void> {
  if (!props.post) return

  try {
    const escrita = await compose({ id: props.post.id, extra: extra.value.trim() || undefined })

    caption.value = escrita.caption ?? ''
    hashtags.value = escrita.hashtags.join(' ')
    extra.value = ''
  } catch (e) {
    // El asistente puede estar caído, y eso no rompe nada: el texto se
    // escribe a mano, que es lo que se hacía antes de que esto existiera.
    notify(extractErrorMessage(e, 'El asistente no pudo escribirlo.'), 'error')
  }
}

async function programar(): Promise<void> {
  if (!props.post || !fecha.value) return

  // Se guarda primero: programar sin guardar dejaría aprobado un texto
  // distinto del que la persona tiene en pantalla.
  if (!(await guardar())) return

  try {
    await schedule({
      id: props.post.id,
      // Sin zona: el servidor la interpreta en la del negocio, que es la que
      // la persona tiene en la cabeza al elegir "jueves a las 10".
      scheduledFor: `${fecha.value}T${hora.value}:00`,
    })

    notify('Programada.', 'success')
    emit('close')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos programarla.'), 'error')
  }
}

async function marcarPublicada(): Promise<void> {
  if (!props.post) return

  try {
    await markPublished(props.post.id)
    notify('Marcada como publicada.', 'success')
    emit('close')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos marcarla.'), 'error')
  }
}

async function descartar(): Promise<void> {
  if (!props.post) return
  if (!window.confirm('¿Descartar esta publicación?')) return

  try {
    await discard(props.post.id)
    notify('Descartada.', 'success')
    emit('close')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos descartarla.'), 'error')
  }
}

/** El texto completo, listo para pegar. Es lo que reemplaza al botón de publicar. */
async function copiar(): Promise<void> {
  const texto = [caption.value.trim(), tagList().join(' ')].filter(Boolean).join('\n\n')

  try {
    await navigator.clipboard.writeText(texto)
    notify('Texto copiado.', 'success')
  } catch {
    // Sin portapapeles (http sin TLS, permisos del navegador) queda el
    // textarea para seleccionarlo a mano.
    notify('Copia el texto del cuadro a mano.', 'info')
  }
}

function elegirFoto(id: number): void {
  clientPhotoId.value = id
  pendingFile.value = null
  preview.value = null
}

function elegirArchivo(file: File): void {
  pendingFile.value = file
  clientPhotoId.value = null
  preview.value = URL.createObjectURL(file)
}

function quitarImagen(): void {
  pendingFile.value = null
  clientPhotoId.value = null
  preview.value = null
}
</script>

<template>
  <NxModal
    :model-value="abierto"
    size="lg"
    :title="post?.headline ?? 'Publicación'"
    @update:model-value="emit('close')"
  >
    <div v-if="post" class="flex flex-col gap-4">
      <p v-if="post.error" class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {{ post.error }}
      </p>

      <PhotoPicker
        :client-photo-id="clientPhotoId"
        :current-url="preview"
        :disabled="!editable || ocupado"
        @pick-photo="elegirFoto"
        @pick-file="elegirArchivo"
        @clear="quitarImagen"
      />

      <NxTextarea
        v-model="caption"
        label="Texto de la publicación"
        :rows="5"
        :disabled="!editable || ocupado"
      />

      <p v-if="post.written_by_assistant" class="-mt-2 text-xs text-slate-400">
        Lo escribió el asistente. Léelo antes de programarlo.
      </p>

      <div v-if="editable" class="flex flex-wrap items-end gap-3">
        <div class="min-w-56 flex-1">
          <NxInput
            v-model="extra"
            label="Algo que quieras que mencione (opcional)"
            :disabled="ocupado"
          />
        </div>
        <NxButton variant="secondary" :loading="composing" :disabled="ocupado" @click="escribir">
          Escríbeme el texto
        </NxButton>
      </div>

      <NxInput v-model="hashtags" label="Hashtags" :disabled="!editable || ocupado" />

      <div class="grid gap-3 sm:grid-cols-2">
        <NxSelect
          v-model="angle"
          :options="props.angles"
          option-label="label"
          option-value="value"
          label="De qué se trata"
          :disabled="!editable || ocupado"
        />
        <NxSelect
          v-model="serviceId"
          :options="services ?? []"
          option-label="name"
          option-value="id"
          label="Servicio (opcional)"
          :disabled="!editable || ocupado"
        />
      </div>

      <div v-if="editable" class="grid gap-3 sm:grid-cols-2">
        <NxDatePicker v-model="fecha" label="Cuándo sale" :disabled="ocupado" />
        <NxSelect
          v-model="hora"
          :options="horas"
          option-label="label"
          option-value="value"
          label="A qué hora"
          :disabled="ocupado"
        />
      </div>

      <p v-if="editable" class="-mt-1 text-xs text-slate-500">
        A esa hora aparece en «listas para publicar». El sistema no la publica solo: la vitrina del
        negocio la abre una persona.
      </p>

      <p v-else-if="post.published_at" class="text-xs text-slate-500">
        Publicada el {{ new Date(post.published_at).toLocaleString('es-CO') }}.
      </p>
    </div>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-3">
        <button
          v-if="post && post.status !== 'published'"
          type="button"
          class="text-sm text-slate-400 hover:text-red-600"
          @click="descartar"
        >
          Descartar
        </button>
        <span v-else />

        <div class="flex flex-wrap gap-2">
          <NxButton variant="secondary" @click="copiar">Copiar texto</NxButton>

          <NxButton
            v-if="editable"
            variant="secondary"
            :loading="saving"
            :disabled="ocupado"
            @click="guardarYCerrar"
          >
            Guardar
          </NxButton>

          <NxButton
            v-if="editable && post?.status !== 'ready'"
            :loading="scheduling"
            :disabled="ocupado"
            @click="programar"
          >
            Programar
          </NxButton>

          <NxButton
            v-if="post && post.status !== 'published'"
            :loading="publishing"
            :disabled="ocupado"
            @click="marcarPublicada"
          >
            Ya la publiqué
          </NxButton>
        </div>
      </div>
    </template>
  </NxModal>
</template>
