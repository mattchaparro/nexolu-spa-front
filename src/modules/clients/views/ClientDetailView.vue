<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useAuthStore } from '@/stores/auth.store'
import { NxButton, NxInput } from '@/ui'

import {
  STATUS_LABELS,
  useClientProfile,
  useDeletePhoto,
  usePhotoConsent,
  useUpdateClient,
  useUploadPhoto,
} from '../composables/useClients'

const route = useRoute()
const auth = useAuthStore()
const { notify } = useSystemAlert()

const id = computed(() => Number(route.params.id))
const { data: client, isLoading } = useClientProfile(id)
const { mutateAsync: update, isPending: saving } = useUpdateClient()
const { mutateAsync: upload, isPending: uploading } = useUploadPhoto()
const { mutateAsync: removePhoto } = useDeletePhoto()
const { mutateAsync: setConsent, isPending: savingConsent } = usePhotoConsent()

type Tab = 'historial' | 'fotos' | 'datos'
const tab = ref<Tab>('historial')

const name = ref('')
const lastName = ref('')
const phone = ref('')
const email = ref('')
const notes = ref('')
const careNotes = ref('')
const caption = ref('')

/*
 * «¿Te puedo publicar esta foto?».
 *
 * Arranca APAGADO en cada subida y no recuerda la respuesta anterior: el
 * permiso es de la clienta que está enfrente ahora, no una preferencia del
 * negocio. Una casilla que se queda marcada convierte un permiso en un
 * default, que es justo lo que no puede ser.
 */
const consent = ref(false)

watch(
  client,
  (c) => {
    if (!c) return
    name.value = c.name
    lastName.value = c.last_name ?? ''
    phone.value = c.phone ?? ''
    email.value = c.email ?? ''
    notes.value = c.notes ?? ''
    careNotes.value = c.care_notes ?? ''
  },
  { immediate: true },
)

function money(value: number | null): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: auth.business?.currency ?? 'COP',
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

function statusClass(status: string): string {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-800'
  if (status === 'cancelled') return 'bg-slate-100 text-slate-600'
  if (status === 'no_show') return 'bg-red-50 text-red-700'
  return 'bg-indigo-50 text-indigo-800'
}

async function save(): Promise<void> {
  try {
    await update({
      id: id.value,
      name: name.value.trim(),
      last_name: lastName.value.trim() || null,
      phone: phone.value.trim() || null,
      email: email.value.trim() || null,
      notes: notes.value.trim() || null,
      care_notes: careNotes.value.trim() || null,
    })
    notify('Ficha actualizada.', 'success')
  } catch (e) {
    notify(
      (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'No pudimos guardar la ficha.',
      'error',
    )
  }
}

async function onFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  await upload({
    clientId: id.value,
    file,
    caption: caption.value.trim() || undefined,
    marketingConsent: consent.value,
  })
  caption.value = ''
  consent.value = false
  ;(event.target as HTMLInputElement).value = ''
  notify('Foto agregada.', 'success')
}

/** Anotar o retirar el permiso de una foto que ya está en la ficha. */
async function togglePermiso(photoId: number, allowed: boolean): Promise<void> {
  if (
    !allowed &&
    !window.confirm(
      '¿Retirar el permiso? La foto sale de las publicaciones que todavía no se han publicado.',
    )
  ) {
    return
  }

  await setConsent({ id: photoId, allowed })
  notify(allowed ? 'Se puede publicar.' : 'Permiso retirado.', 'success')
}

async function deletePhoto(photoId: number): Promise<void> {
  if (!window.confirm('¿Eliminar esta foto?')) return
  await removePhoto(photoId)
  notify('Foto eliminada.', 'success')
}

async function copiar(url: string, que: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url)
    notify(`Enlace de «${que}» copiado.`, 'success')
  } catch {
    // Sin portapapeles (http sin TLS, permisos del navegador): se muestra para
    // seleccionarlo a mano en vez de dejar a la persona sin salida.
    window.prompt('Copia este enlace:', url)
  }
}

/**
 * Abrir WhatsApp con el mensaje ya escrito.
 *
 * Es el atajo real mientras el envío automático no exista: quien atiende toca
 * un botón y sale el chat con esa clienta y el enlace adentro, sin copiar,
 * pegar ni buscar el contacto.
 */
function whatsappLink(c: {
  phone: string | null
  name: string
  links: { portal: string }
}): string | null {
  const numero = c.phone?.replace(/\D/g, '')
  if (!numero) return null

  const texto = `Hola ${c.name}, acá puedes ver y cambiar tus citas: ${c.links.portal}`

  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}
</script>

<template>
  <section class="p-6 md:p-8">
    <RouterLink :to="{ name: 'clients' }" class="text-sm text-indigo-600 hover:underline"
      >‹ Clientes</RouterLink
    >

    <p v-if="isLoading" class="mt-6 text-sm text-slate-500">Cargando…</p>

    <template v-else-if="client">
      <header class="mb-6 mt-2">
        <h1 class="text-xl font-semibold text-slate-800">{{ client.full_name }}</h1>
        <p class="mt-1 text-sm text-slate-500">
          {{ client.phone ?? 'Sin teléfono' }}
          <span v-if="client.created_at" class="text-slate-400">
            · cliente desde {{ client.created_at }}</span
          >
        </p>
      </header>

      <!-- Lo que hay que saber ANTES de atender va primero y en amarillo:
           alergias, preferencias. Enterrarlo en una pestaña es como alguien
           termina usando un producto al que el cliente es alérgico. -->
      <div
        v-if="client.care_notes"
        class="mb-6 rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <p class="font-medium">Antes de atender</p>
        <p class="mt-0.5 whitespace-pre-line">{{ client.care_notes }}</p>
      </div>

      <!-- Sus enlaces personales, para mandárselos por tu propio WhatsApp.
           Existen porque el envío automático todavía no funciona: sin esto,
           "mis citas" y el formulario prellenado son pantallas a las que nadie
           puede entrar hasta que Meta apruebe un número. -->
      <div class="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <p class="text-sm font-medium text-slate-800">Enlaces para {{ client.name }}</p>
        <p class="mt-0.5 text-xs text-slate-500">
          Cópialos y mándaselos por WhatsApp. Son personales: sólo abren sus citas.
        </p>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
            @click="copiar(client.links.portal, 'Sus citas')"
          >
            Copiar «Mis citas»
          </button>
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
            @click="copiar(client.links.booking, 'Reservar')"
          >
            Copiar «Reservar con sus datos»
          </button>
          <a
            v-if="whatsappLink(client)"
            :href="whatsappLink(client)!"
            target="_blank"
            rel="noopener"
            class="rounded-md border border-emerald-300 px-3 py-1.5 text-sm text-emerald-800"
          >
            Abrir WhatsApp con el enlace
          </a>
        </div>
      </div>

      <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article class="rounded-lg border border-slate-200 bg-white p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">Visitas</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-slate-800">
            {{ client.stats.visits }}
          </p>
          <p v-if="client.stats.last_visit" class="text-xs text-slate-500">
            Última: {{ client.stats.last_visit }}
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">Ha gastado</p>
          <p class="mt-1 text-xl font-semibold tabular-nums text-slate-800">
            {{ money(client.stats.total_spent) }}
          </p>
          <p class="text-xs text-slate-500">Ticket {{ money(client.stats.average_ticket) }}</p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">Prefiere</p>
          <p class="mt-1 text-sm font-medium text-slate-800">
            {{ client.stats.favorite_resource ?? '—' }}
          </p>
          <p class="text-xs text-slate-500">
            {{ client.stats.favorite_service ?? 'Sin historial' }}
          </p>
        </article>

        <article
          class="rounded-lg border p-3"
          :class="
            client.stats.no_shows > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
          "
        >
          <p class="text-xs uppercase tracking-wide text-slate-400">No asistió</p>
          <p
            class="mt-1 text-xl font-semibold tabular-nums"
            :class="client.stats.no_shows > 0 ? 'text-red-700' : 'text-slate-800'"
          >
            {{ client.stats.no_shows }}
          </p>
          <p v-if="client.stats.next_appointment" class="text-xs text-slate-500">
            Próxima: {{ client.stats.next_appointment.label }}
          </p>
        </article>
      </div>

      <div class="mb-4 flex gap-1 border-b border-slate-200">
        <button
          v-for="option in ['historial', 'fotos', 'datos'] as Tab[]"
          :key="option"
          type="button"
          class="border-b-2 px-4 py-2 text-sm capitalize"
          :class="
            tab === option
              ? 'border-indigo-600 font-medium text-indigo-700'
              : 'border-transparent text-slate-500'
          "
          @click="tab = option"
        >
          {{ option }}
          <span v-if="option === 'fotos'" class="text-xs text-slate-400"
            >({{ client.photos.length }})</span
          >
        </button>
      </div>

      <!-- Historial -->
      <div v-if="tab === 'historial'" class="flex flex-col gap-2">
        <p
          v-if="!client.history.length"
          class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600"
        >
          Todavía no tiene citas.
        </p>

        <article
          v-for="entry in client.history"
          :key="entry.id"
          class="rounded-lg border border-slate-200 bg-white px-4 py-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span class="font-medium tabular-nums text-slate-800">{{ entry.date }}</span>
              <span class="ml-2 tabular-nums text-slate-500">{{ entry.time }}</span>
              <span class="ml-2 rounded px-2 py-0.5 text-xs" :class="statusClass(entry.status)">
                {{ STATUS_LABELS[entry.status] ?? entry.status }}
              </span>
            </div>
            <span v-if="entry.is_paid" class="text-sm tabular-nums text-slate-700">
              {{ money(entry.total) }}
              <span class="text-xs text-slate-400">{{ entry.payment_method }}</span>
            </span>
          </div>

          <p v-for="item in entry.items" :key="item.id" class="mt-1 text-sm text-slate-600">
            {{ item.service_name }} · {{ item.resource_name }}
          </p>

          <p v-if="entry.notes" class="mt-1 text-xs italic text-slate-500">{{ entry.notes }}</p>
        </article>
      </div>

      <!-- Fotos del trabajo -->
      <div v-else-if="tab === 'fotos'">
        <div v-if="auth.can('clientes.gestionar')" class="mb-4 flex flex-wrap items-end gap-3">
          <div class="w-64">
            <NxInput v-model="caption" label="Descripción (opcional)" :disabled="uploading" />
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="pb-2 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
            :disabled="uploading"
            @change="onFile"
          />

          <!--
            El permiso se pide ACÁ, mientras la clienta está enfrente
            mirándose las manos. Preguntarle dos semanas después, cuando
            alguien arma el calendario, es como se termina publicando sin
            preguntar.
          -->
          <label class="flex items-center gap-2 pb-2 text-sm text-slate-600">
            <input v-model="consent" type="checkbox" class="size-4" :disabled="uploading" />
            Puedo publicarla en las redes
          </label>
        </div>

        <p
          v-if="!client.photos.length"
          class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600"
        >
          Sin fotos todavía. Son la referencia de qué se le hizo la vez pasada.
        </p>

        <div v-else class="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <figure
            v-for="photo in client.photos"
            :key="photo.id"
            class="overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <img :src="photo.url" :alt="photo.caption ?? ''" class="h-36 w-full object-cover" />
            <figcaption class="p-2 text-xs">
              <p class="text-slate-700">
                {{ photo.caption ?? photo.service_name ?? 'Sin descripción' }}
              </p>
              <div class="mt-1 flex items-center justify-between">
                <span class="text-slate-400">{{ photo.date }}</span>
                <button
                  v-if="auth.can('clientes.gestionar')"
                  type="button"
                  class="text-slate-400 hover:text-red-600"
                  @click="deletePhoto(photo.id)"
                >
                  Eliminar
                </button>
              </div>

              <button
                v-if="auth.can('clientes.gestionar')"
                type="button"
                class="mt-1.5 w-full rounded px-1.5 py-1 text-left text-[11px]"
                :class="
                  photo.marketing_consent
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
                "
                :disabled="savingConsent"
                @click="togglePermiso(photo.id, !photo.marketing_consent)"
              >
                {{ photo.marketing_consent ? '✓ Se puede publicar' : 'Sin permiso para publicar' }}
              </button>
            </figcaption>
          </figure>
        </div>
      </div>

      <!-- Datos -->
      <div v-else class="max-w-xl">
        <div class="flex flex-col gap-3">
          <div class="grid gap-3 sm:grid-cols-2">
            <NxInput v-model="name" label="Nombre" :disabled="saving" />
            <NxInput v-model="lastName" label="Apellido" :disabled="saving" />
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <NxInput v-model="phone" label="Teléfono" inputmode="tel" :disabled="saving" />
            <NxInput v-model="email" type="email" label="Correo" :disabled="saving" />
          </div>

          <NxInput
            v-model="careNotes"
            label="Antes de atender (alergias, preferencias)"
            :disabled="saving"
          />
          <NxInput v-model="notes" label="Notas generales" :disabled="saving" />

          <NxButton
            v-if="auth.can('clientes.gestionar')"
            class="self-start"
            :loading="saving"
            @click="save"
          >
            Guardar
          </NxButton>
        </div>
      </div>
    </template>
  </section>
</template>
