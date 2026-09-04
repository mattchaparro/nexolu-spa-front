<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useServices } from '@/modules/agenda/composables/useAvailability'
import { NxButton, NxDatePicker, NxInput, NxModal, NxSelect, NxTextarea } from '@/ui'
import { extractErrorMessage } from '@/utils/extractErrorMessage'

import PostImages from './PostImages.vue'
import {
  useComposePost,
  useDiscardPost,
  useMarkPublished,
  usePublishNow,
  useSavePost,
  useSchedulePost,
  type InstagramState,
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
  instagram: InstagramState
}>()

const emit = defineEmits<{ close: [] }>()

const { notify } = useSystemAlert()

const { data: services } = useServices()

const { mutateAsync: save, isPending: saving } = useSavePost()
const { mutateAsync: compose, isPending: composing } = useComposePost()
const { mutateAsync: schedule, isPending: scheduling } = useSchedulePost()
const { mutateAsync: markPublished, isPending: publishing } = useMarkPublished()
const { mutateAsync: publishNow, isPending: sending } = usePublishNow()
const { mutateAsync: discard } = useDiscardPost()

const caption = ref('')
const hashtags = ref('')
const angle = ref('libre')
const serviceId = ref<number | null>(null)
const extra = ref('')

/*
 * Cómo va a quedar el carrusel. Tres listas y no una: `keepIds` son las que ya
 * estaban —en el orden elegido— y las otras dos se agregan al final, que es
 * exactamente lo que hace el servidor. Una sola lista mezclada prometería un
 * orden que no va a ocurrir.
 */
const keepIds = ref<number[]>([])
const newPhotoIds = ref<number[]>([])
const newFiles = ref<File[]>([])

const fecha = ref<string | null>(null)
const hora = ref('10:00')

const abierto = computed(() => props.post !== null)
const editable = computed(() => ['draft', 'scheduled', 'ready'].includes(props.post?.status ?? ''))
const ocupado = computed(
  () => saving.value || composing.value || scheduling.value || publishing.value || sending.value,
)

/*
 * Lo que Instagram rechazaría, dicho antes de apretar nada. Lo resuelve el
 * servidor —la proporción se mide leyendo el archivo— y la pantalla sólo lo
 * muestra: apretar un botón que ya sabemos que falla gasta cupo del límite
 * diario de la cuenta.
 */
const rechazo = computed(() => props.post?.rejected_reason ?? null)

const puedeMandar = computed(
  () => props.instagram.can_publish && rechazo.value === null && props.post?.status !== 'published',
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
    keepIds.value = post.images.map((i) => i.id)
    newPhotoIds.value = []
    newFiles.value = []

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
      keep_image_ids: keepIds.value,
      client_photo_ids: newPhotoIds.value,
      images: newFiles.value,
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

/**
 * Publicar de verdad, contra Instagram.
 *
 * Se guarda primero: mandar sin guardar publicaría un texto distinto del que
 * la persona tiene en pantalla.
 */
async function publicarAhora(): Promise<void> {
  if (!props.post) return
  if (!window.confirm('¿Publicarla en Instagram ahora?')) return

  if (editable.value && !(await guardar())) return

  try {
    await publishNow(props.post.id)
    notify('Publicada en Instagram.', 'success')
    emit('close')
  } catch (e) {
    notify(extractErrorMessage(e, 'Instagram no la aceptó.'), 'error')
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

      <!--
        Lo que Instagram rechazaría, antes de intentarlo. Cuando lo rechaza
        Meta, lo que vuelve es un código en inglés y ya se gastó cupo del
        límite diario de la cuenta.
      -->
      <p
        v-if="rechazo && instagram.can_publish"
        class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
      >
        {{ rechazo }}
      </p>

      <PostImages
        v-model:keep="keepIds"
        v-model:photos="newPhotoIds"
        v-model:files="newFiles"
        :images="post.images"
        :disabled="!editable || ocupado"
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

      <!--
        Lo que va a pasar a esa hora depende de si el negocio conectó su
        cuenta, y decirlo cambia lo que la persona espera.
      -->
      <p v-if="editable && instagram.can_publish" class="-mt-1 text-xs text-slate-500">
        A esa hora sale sola en Instagram, como
        <span class="font-medium">@{{ instagram.username }}</span
        >. Programarla es aprobarla.
      </p>

      <p v-else-if="editable" class="-mt-1 text-xs text-slate-500">
        A esa hora aparece en «listas para publicar» y alguien la copia y la pega.
        <template v-if="instagram.reason"> {{ instagram.reason }}</template>
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

          <!--
            Con cuenta conectada, publicar de verdad. Sin ella, marcar lo que
            alguien ya pegó a mano — que es el modo por defecto del producto,
            no un estado degradado.
          -->
          <NxButton
            v-if="puedeMandar"
            :loading="sending"
            :disabled="ocupado"
            @click="publicarAhora"
          >
            Publicar ahora
          </NxButton>

          <NxButton
            v-else-if="post && post.status !== 'published'"
            variant="secondary"
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
