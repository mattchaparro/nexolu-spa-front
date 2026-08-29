<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { httpClient } from '@/services/http/client'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton } from '@/ui'

interface PublicPagePayload {
  enabled: boolean
  slug: string
  profile: Record<string, string | null>
  labels: Record<string, string>
  logo_url: string | null
  cover_url: string | null
  services: Array<{ id: number; name: string; is_bookable_online: boolean }>
}

const { notify } = useSystemAlert()
const queryClient = useQueryClient()

const { data, isLoading } = useQuery({
  queryKey: ['public-page'],
  queryFn: async () => (await httpClient.get<PublicPagePayload>('/public-page')).data,
})

const form = ref<Record<string, string>>({
  headline: '',
  about: '',
  instagram: '',
  whatsapp: '',
  maps_url: '',
})
const cover = ref<File | null>(null)
const offered = ref<Set<number>>(new Set())
const error = ref<string | null>(null)

watch(
  data,
  (payload) => {
    if (!payload) return

    for (const key of Object.keys(form.value)) {
      form.value[key] = payload.profile[key] ?? ''
    }

    offered.value = new Set(
      payload.services.filter((s) => s.is_bookable_online).map((s) => s.id),
    )
  },
  { immediate: true },
)

const publicUrl = computed(() =>
  data.value ? `${window.location.origin}/reservar/${data.value.slug}` : '',
)

const { mutateAsync: save, isPending: saving } = useMutation({
  mutationFn: async () => {
    const body = new FormData()

    for (const [key, value] of Object.entries(form.value)) {
      body.append(key, value)
    }

    if (cover.value) {
      body.append('cover', cover.value)
    }

    return (await httpClient.post('/public-page', body)).data
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public-page'] }),
})

const { mutateAsync: syncServices, isPending: syncing } = useMutation({
  mutationFn: async (ids: number[]) =>
    (await httpClient.put('/public-page/services', { service_ids: ids })).data,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public-page'] }),
})

function toggle(id: number): void {
  const next = new Set(offered.value)
  next.has(id) ? next.delete(id) : next.add(id)
  offered.value = next
  void syncServices([...next])
}

async function submit(): Promise<void> {
  error.value = null

  try {
    await save()
    cover.value = null
    notify('Tu página quedó actualizada.', 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar la página.')
  }
}

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(publicUrl.value)
    notify('Enlace copiado.', 'success')
  } catch {
    // Sin portapapeles (http sin TLS, permisos): el enlace está a la vista y
    // se puede seleccionar a mano.
    notify('Copia el enlace de arriba a mano.', 'warn')
  }
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Tu página pública</h1>
      <p class="mt-1 max-w-2xl text-sm text-slate-500">
        Donde tus clientas te encuentran y reservan solas. Compártela en tu Instagram y en tu
        WhatsApp.
      </p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <div v-else-if="data" class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div class="min-w-0">
        <!-- El enlace, arriba del todo: es lo que vienen a buscar. -->
        <div class="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <p class="text-xs uppercase tracking-wide text-indigo-500">Tu enlace</p>
          <p class="mt-1 break-all font-mono text-sm text-indigo-900">{{ publicUrl }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <NxButton size="sm" @click="copyLink">Copiar enlace</NxButton>
            <a
              :href="publicUrl"
              target="_blank"
              rel="noopener"
              class="rounded-md border border-indigo-300 px-3 py-1.5 text-sm text-indigo-800"
            >
              Ver cómo se ve
            </a>
          </div>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="mb-4 text-sm font-medium text-slate-800">Lo que dice tu página</h2>

          <div class="flex flex-col gap-4">
            <label class="text-sm text-slate-700">
              {{ data.labels.headline }}
              <input
                v-model="form.headline"
                maxlength="120"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-800"
                :placeholder="'Ej: Uñas que hablan por ti'"
                :disabled="saving"
              />
              <span class="mt-1 block text-xs text-slate-500">
                Si la dejas vacía se usa el nombre del negocio.
              </span>
            </label>

            <label class="text-sm text-slate-700">
              {{ data.labels.about }}
              <textarea
                v-model="form.about"
                rows="3"
                maxlength="1000"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-800"
                placeholder="Cuéntale a tu clienta quién eres y qué la espera."
                :disabled="saving"
              />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="text-sm text-slate-700">
                {{ data.labels.instagram }}
                <input
                  v-model="form.instagram"
                  class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-800"
                  placeholder="@tunegocio"
                  :disabled="saving"
                />
              </label>

              <label class="text-sm text-slate-700">
                {{ data.labels.whatsapp }}
                <input
                  v-model="form.whatsapp"
                  inputmode="tel"
                  class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-800"
                  :disabled="saving"
                />
              </label>
            </div>

            <label class="text-sm text-slate-700">
              {{ data.labels.maps_url }}
              <input
                v-model="form.maps_url"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-800"
                placeholder="https://maps.app.goo.gl/…"
                :disabled="saving"
              />
              <span class="mt-1 block text-xs text-slate-500">
                Hace que tu dirección sea tocable y abra el mapa.
              </span>
            </label>

            <label class="text-sm text-slate-700">
              Foto de portada
              <input
                type="file"
                accept="image/*"
                class="mt-1 block w-full text-sm text-slate-600"
                :disabled="saving"
                @change="cover = ($event.target as HTMLInputElement).files?.[0] ?? null"
              />
              <img
                v-if="data.cover_url && !cover"
                :src="data.cover_url"
                alt="Portada actual"
                class="mt-2 h-28 w-full rounded-md object-cover"
              />
            </label>

            <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ error }}
            </p>

            <NxButton class="self-start" :loading="saving" @click="submit">Guardar</NxButton>
          </div>
        </div>
      </div>

      <!-- Qué se ofrece por internet -->
      <aside class="self-start rounded-lg border border-slate-200 bg-white">
        <div class="border-b border-slate-100 px-4 py-3">
          <p class="text-sm font-medium text-slate-800">Servicios que se reservan solos</p>
          <!-- La decisión que más se olvida: entra un servicio nuevo al
               catálogo y nadie se acuerda de que la página no lo muestra. -->
          <p class="mt-1 text-xs text-slate-500">
            Los que dejes apagados siguen en tu catálogo, pero no aparecen en la página.
          </p>
        </div>

        <label
          v-for="item in data.services"
          :key="item.id"
          class="flex items-center gap-3 border-b border-slate-50 px-4 py-2.5 last:border-b-0"
        >
          <input
            type="checkbox"
            :checked="offered.has(item.id)"
            :disabled="syncing"
            @change="toggle(item.id)"
          />
          <span class="text-sm text-slate-700">{{ item.name }}</span>
        </label>
      </aside>
    </div>
  </section>
</template>
