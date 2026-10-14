<script setup lang="ts">
/*
 * Enlaces de WhatsApp con tu propio mensaje.
 *
 * Para pegar en una historia de Instagram, en la biografía o en un anuncio: al
 * tocarlos se abre tu WhatsApp con el mensaje ya escrito, y de ahí el asistente
 * toma la conversación. Cada enlace se guarda con un nombre para volver a
 * copiarlo cuando haga falta («Historia del sábado», «Promo press-on»).
 */
import { computed, ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useServices } from '@/modules/agenda/composables/useAvailability'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton } from '@/ui'

import {
  buildWhatsappUrl,
  useDeleteWhatsappLink,
  useSaveWhatsappLink,
  useWhatsappLinks,
  type WhatsappLink,
} from '../composables/useWhatsappLinks'

const { notify } = useSystemAlert()
const { data, isLoading } = useWhatsappLinks()
const { data: services } = useServices()
const { mutateAsync: save, isPending: saving } = useSaveWhatsappLink()
const { mutateAsync: remove } = useDeleteWhatsappLink()

const editingId = ref<number | null>(null)
const name = ref('')
const message = ref('')
const error = ref<string | null>(null)

const number = computed(() => data.value?.number ?? null)
const preview = computed(() => buildWhatsappUrl(number.value, message.value))

/** Arrancar el mensaje desde un servicio; después se edita como se quiera. */
function fromService(event: Event): void {
  const id = Number((event.target as HTMLSelectElement).value)
  const service = services.value?.find((s) => s.id === id)

  if (service) {
    message.value = `Hola, quiero agendar ${service.name} 💅`
    name.value ||= service.name
  }
}

function edit(link: WhatsappLink): void {
  editingId.value = link.id
  name.value = link.name
  message.value = link.message
  error.value = null
}

function reset(): void {
  editingId.value = null
  name.value = ''
  message.value = ''
  error.value = null
}

async function submit(): Promise<void> {
  error.value = null

  try {
    await save({ id: editingId.value ?? undefined, name: name.value, message: message.value })
    notify(editingId.value ? 'Enlace actualizado.' : 'Enlace guardado.', 'success')
    reset()
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar el enlace.')
  }
}

async function destroy(link: WhatsappLink): Promise<void> {
  if (!window.confirm(`¿Borrar el enlace «${link.name}»? Los que ya pegaste siguen funcionando.`)) {
    return
  }

  try {
    await remove(link.id)
    if (editingId.value === link.id) reset()
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos borrarlo.'), 'error')
  }
}

async function copy(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url)
    notify('Enlace copiado.', 'success')
  } catch {
    // Sin portapapeles (http sin TLS, permisos): el enlace está a la vista.
    notify('Copia el enlace a mano: está a la vista.', 'warn')
  }
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Enlaces de WhatsApp</h1>
      <p class="mt-1 max-w-2xl text-sm text-slate-500">
        Crea un enlace con tu propio mensaje y pégalo en tus historias de Instagram, tu biografía o
        un anuncio. Al tocarlo se abre tu WhatsApp con el mensaje ya escrito.
      </p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <template v-else>
      <p
        v-if="!number"
        class="mb-6 max-w-2xl rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
        data-testid="wa-links-missing-number"
      >
        Falta el número de WhatsApp del negocio. Escríbelo en «Tu página pública» (campo WhatsApp) y
        vuelve aquí.
      </p>

      <div class="grid gap-6 lg:grid-cols-2">
        <form
          class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5"
          @submit.prevent="submit"
        >
          <h2 class="text-sm font-medium text-slate-800">
            {{ editingId ? 'Editar enlace' : 'Nuevo enlace' }}
          </h2>

          <label class="text-sm text-slate-700">
            Nombre (solo para ti)
            <input
              v-model="name"
              maxlength="80"
              placeholder="Ej: Historia del sábado"
              class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-800"
              data-testid="wa-links-name"
              :disabled="saving"
            />
          </label>

          <label class="text-sm text-slate-700">
            Mensaje con el que te escriben
            <textarea
              v-model="message"
              rows="3"
              maxlength="500"
              placeholder="Ej: Hola, vi la historia y quiero el press-on 💅"
              class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-800"
              data-testid="wa-links-message"
              :disabled="saving"
            />
          </label>

          <label class="text-sm text-slate-700">
            ¿Quieres arrancar desde un servicio?
            <select
              class="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-800"
              data-testid="wa-links-service"
              :disabled="saving"
              @change="fromService"
            >
              <option value="">No, lo escribo yo</option>
              <option v-for="s in services ?? []" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>

          <div v-if="preview" class="rounded-md bg-slate-50 p-3">
            <p class="text-xs uppercase tracking-wide text-slate-500">Así queda el enlace</p>
            <p
              class="mt-1 break-all font-mono text-xs text-slate-700"
              data-testid="wa-links-preview"
            >
              {{ preview }}
            </p>
            <button
              type="button"
              class="mt-2 rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700"
              @click="copy(preview)"
            >
              Copiar sin guardar
            </button>
          </div>

          <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {{ error }}
          </p>

          <div class="flex gap-2">
            <NxButton
              type="submit"
              size="sm"
              :loading="saving"
              :disabled="!name.trim() || !message.trim()"
            >
              {{ editingId ? 'Guardar cambios' : 'Guardar enlace' }}
            </NxButton>
            <button
              v-if="editingId"
              type="button"
              class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              @click="reset"
            >
              Cancelar
            </button>
          </div>
        </form>

        <div class="flex flex-col gap-3">
          <h2 class="text-sm font-medium text-slate-800">Tus enlaces guardados</h2>

          <p
            v-if="!data?.links.length"
            class="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-500"
          >
            Todavía no tienes ninguno. Crea el primero a la izquierda.
          </p>

          <article
            v-for="link in data?.links ?? []"
            :key="link.id"
            class="rounded-lg border border-slate-200 bg-white p-4"
            data-testid="wa-links-item"
          >
            <p class="font-medium text-slate-800">{{ link.name }}</p>
            <p class="mt-1 text-sm text-slate-600">{{ link.message }}</p>
            <p class="mt-2 break-all font-mono text-xs text-slate-500">
              {{ buildWhatsappUrl(number, link.message) }}
            </p>

            <div class="mt-3 flex flex-wrap gap-2">
              <NxButton
                size="sm"
                :disabled="!number"
                @click="copy(buildWhatsappUrl(number, link.message))"
              >
                Copiar enlace
              </NxButton>
              <a
                v-if="number"
                :href="buildWhatsappUrl(number, link.message)"
                target="_blank"
                rel="noopener"
                class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              >
                Probarlo
              </a>
              <button
                type="button"
                class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                @click="edit(link)"
              >
                Editar
              </button>
              <button
                type="button"
                class="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700"
                @click="destroy(link)"
              >
                Borrar
              </button>
            </div>
          </article>
        </div>
      </div>
    </template>
  </section>
</template>
