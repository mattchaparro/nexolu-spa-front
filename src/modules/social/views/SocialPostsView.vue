<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSystemAlert } from '@/composables/useSystemAlert'
import LocationPicker from '@/modules/settings/components/LocationPicker.vue'
import { NxButton } from '@/ui'
import { extractErrorMessage } from '@/utils/extractErrorMessage'

import PostEditorModal from '../components/PostEditorModal.vue'
import {
  usePlanPosts,
  useSavePost,
  useSocialBoard,
  type InstagramState,
  type SocialPost,
} from '../composables/useSocialPosts'

/*
 * «Publicaciones»: el calendario de las redes del negocio.
 *
 * La pantalla tiene DOS MITADES y ese es todo su diseño:
 *
 *   La BANDEJA — ideas que el sistema propuso mirando la agenda, las fotos con
 *   permiso y el catálogo. Nadie las ha mirado todavía y no tienen fecha.
 *
 *   El CALENDARIO — lo que ya tiene fecha, agrupado por día.
 *
 * Mover algo de la primera al segundo es aprobarlo, y es el único momento en
 * que una persona decide. El sistema no publica: cuando llega la hora, la
 * publicación aparece arriba en «listas para publicar» y espera a que alguien
 * la pegue en Instagram. Ver docs/publicaciones.md en el API.
 */
const { notify } = useSystemAlert()
const route = useRoute()
const router = useRouter()

const locationId = ref<number | null>(null)

const { data, isLoading } = useSocialBoard(locationId)
const { mutateAsync: buscarIdeas, isPending: buscando } = usePlanPosts()
const { mutateAsync: crear, isPending: creando } = useSavePost()

const abierta = ref<SocialPost | null>(null)

const tray = computed(() => data.value?.tray ?? [])

/*
 * `?abrir=` la deja abierta al llegar.
 *
 * Es lo que hace que «Crear publicación» desde la ficha de una clienta no
 * termine en una bandeja donde hay que buscar cuál de todas es la que uno
 * acaba de crear. Se limpia de la URL en cuanto se usa: recargar la página
 * media hora después no debería reabrir un modal.
 */
watch(
  [() => route.query.abrir, data],
  ([id, board]) => {
    if (!id || !board) return

    const buscada = [...board.tray, ...board.calendar].find((p) => String(p.id) === String(id))

    if (buscada) {
      abierta.value = buscada
      router.replace({ query: {} })
    }
  },
  { immediate: true },
)
const angles = computed(() => data.value?.angles ?? [])

/*
 * Sin conexión aún cargando, se asume lo conservador: sin cuenta. Mostrar
 * «publica sola» un instante y después corregirlo es peor que no decir nada.
 */
const instagram = computed<InstagramState>(
  () =>
    data.value?.instagram ?? {
      connected: false,
      username: null,
      can_publish: false,
      expires_soon: false,
      reason: null,
    },
)

/** Lo que ya cumplió su hora y sigue sin salir. Es el único atraso posible. */
const listas = computed(() => (data.value?.calendar ?? []).filter((p) => p.status === 'ready'))

/** Lo que viene y lo que ya salió, por día. */
const porDia = computed(() => {
  const grupos = new Map<string, SocialPost[]>()

  for (const post of data.value?.calendar ?? []) {
    if (post.status === 'ready') continue

    const cuando = post.scheduled_for ?? post.published_at
    if (!cuando) continue

    const dia = new Date(cuando).toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })

    grupos.set(dia, [...(grupos.get(dia) ?? []), post])
  }

  return [...grupos.entries()]
})

function hora(iso: string | null): string {
  if (!iso) return ''

  return new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
}

async function ideas(): Promise<void> {
  try {
    const r = await buscarIdeas()
    notify(r.message, r.proposed > 0 ? 'success' : 'info')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos buscar ideas.'), 'error')
  }
}

/** Una publicación que se le ocurrió a una persona: nace vacía y se abre. */
async function nueva(): Promise<void> {
  try {
    abierta.value = await crear({ angle: 'libre', location_id: locationId.value })
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos crearla.'), 'error')
  }
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Publicaciones</h1>
        <p class="mt-1 max-w-2xl text-sm text-slate-500">
          Las ideas salen de lo que ya pasó acá: una foto de un trabajo con permiso de la clienta,
          un día con horas libres, un servicio que se dejó de vender. Tú decides cuáles valen y
          cuándo salen.
          <template v-if="instagram.can_publish">
            Salen solas como <span class="font-medium">@{{ instagram.username }}</span
            >.
          </template>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <LocationPicker v-model="locationId" label="Sede" />
        <NxButton variant="secondary" :loading="buscando" @click="ideas">Buscar ideas</NxButton>
        <NxButton :loading="creando" @click="nueva">Nueva</NxButton>
      </div>
    </header>

    <!--
      Un token que caduca no avisa: el día sesenta y uno las publicaciones
      dejan de salir en silencio, y nadie revisa una cuenta que funcionaba.
      Por eso el aviso va arriba de todo y diez días antes.
    -->
    <p
      v-if="instagram.connected && (instagram.expires_soon || !instagram.can_publish)"
      class="mb-6 rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      {{
        instagram.reason ??
        'El permiso de Instagram caduca pronto. Hay que reconectar la cuenta para que las publicaciones sigan saliendo solas.'
      }}
    </p>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <template v-else>
      <!--
        Arriba del todo: lo que ya debía haber salido. Es lo único que este
        módulo puede tener atrasado, y esconderlo entre lo demás sería
        convertir una lista de pendientes en decoración.
      -->
      <div v-if="listas.length" class="mb-8">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-700">
          Listas para publicar ({{ listas.length }})
        </h2>

        <div class="flex flex-col gap-3">
          <article
            v-for="post in listas"
            :key="post.id"
            class="cursor-pointer rounded-lg border border-amber-300 bg-amber-50 p-4"
            @click="abierta = post"
          >
            <div class="flex flex-wrap items-start gap-4">
              <img
                v-if="post.image_url"
                :src="post.image_url"
                alt=""
                class="h-16 w-16 shrink-0 rounded-md object-cover"
              />
              <div class="min-w-48 flex-1">
                <p class="font-medium text-slate-800">{{ post.headline }}</p>
                <p class="mt-1 line-clamp-2 text-sm text-slate-600">{{ post.caption }}</p>
              </div>
              <p class="text-xs text-amber-800">Tocaba a las {{ hora(post.scheduled_for) }}</p>
            </div>
          </article>
        </div>
      </div>

      <div class="grid gap-8 lg:grid-cols-2">
        <!-- La bandeja -->
        <div>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Ideas por revisar ({{ tray.length }})
          </h2>

          <p
            v-if="!tray.length"
            class="rounded-lg bg-slate-100 px-4 py-8 text-center text-sm text-slate-600"
          >
            Nada nuevo que contar por ahora. Las ideas aparecen solas cada mañana; «Buscar ideas»
            adelanta esa revisión.
          </p>

          <div v-else class="flex flex-col gap-3">
            <article
              v-for="post in tray"
              :key="post.id"
              class="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300"
              @click="abierta = post"
            >
              <div class="flex items-start gap-3">
                <img
                  v-if="post.image_url"
                  :src="post.image_url"
                  alt=""
                  class="h-14 w-14 shrink-0 rounded-md object-cover"
                />
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-slate-800">{{ post.headline }}</p>
                  <p class="mt-0.5 text-xs text-slate-400">
                    {{ post.angle_label }}
                    <span v-if="post.source === 'auto'"> · la propuso el sistema</span>
                    <span v-if="post.location_name"> · {{ post.location_name }}</span>
                  </p>
                  <p v-if="post.caption" class="mt-1 line-clamp-2 text-sm text-slate-600">
                    {{ post.caption }}
                  </p>
                  <p v-else class="mt-1 text-sm italic text-slate-400">Sin texto todavía.</p>
                </div>
              </div>
            </article>
          </div>
        </div>

        <!-- El calendario -->
        <div>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Programadas y publicadas
          </h2>

          <p
            v-if="!porDia.length"
            class="rounded-lg bg-slate-100 px-4 py-8 text-center text-sm text-slate-600"
          >
            Todavía no hay nada con fecha. Abre una idea de la izquierda y prográmala.
          </p>

          <div v-else class="flex flex-col gap-5">
            <div v-for="[dia, posts] in porDia" :key="dia">
              <p class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                {{ dia }}
              </p>

              <div class="flex flex-col gap-2">
                <article
                  v-for="post in posts"
                  :key="post.id"
                  class="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300"
                  @click="abierta = post"
                >
                  <img
                    v-if="post.image_url"
                    :src="post.image_url"
                    alt=""
                    class="h-12 w-12 shrink-0 rounded-md object-cover"
                  />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-slate-800">{{ post.headline }}</p>
                    <p class="text-xs text-slate-400">
                      {{ hora(post.scheduled_for ?? post.published_at) }} ·
                      {{ post.status_label }}
                      <span v-if="post.approved_by"> · aprobó {{ post.approved_by }}</span>
                    </p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <PostEditorModal
      :post="abierta"
      :angles="angles"
      :instagram="instagram"
      @close="abierta = null"
    />
  </section>
</template>
