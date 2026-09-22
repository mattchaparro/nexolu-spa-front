<script setup lang="ts">
/*
 * "Enséñale al bot": las preguntas frecuentes que el bot de WhatsApp
 * responde por su cuenta (garantías, parqueadero, qué pasa si llego tarde).
 *
 * Nace de una conversación real: preguntaron por la política de garantías,
 * el bot contestó "no tengo esa información" -- no estaba escrita en
 * ningún lado -- y la clienta terminó esperando a una persona que no llegó.
 *
 * Se guardan en el IA Core (el núcleo del bot, que otras apps también
 * usan); esta pantalla habla con él a través del spa, que es quien sabe
 * quién puede editar. Precios, horarios y citas NO van aquí: esos el bot
 * los consulta en vivo.
 */
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { httpClient } from '@/services/http/client'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxModal, NxSwitch, NxTextarea } from '@/ui'

/** Espejo de `KnowledgeOut` (nexolu-ia-core/nexolu_ia_core/api/v1/knowledge.py). */
interface KnowledgeEntry {
  id: string
  topic: string
  answer: string
  is_active: boolean
  updated_at: string
}

const { notify } = useSystemAlert()
const queryClient = useQueryClient()

const {
  data: entries,
  isLoading,
  error: loadError,
} = useQuery({
  queryKey: ['bot-knowledge'],
  queryFn: async () => (await httpClient.get<{ data: KnowledgeEntry[] }>('/bot/knowledge')).data.data,
})

const refresh = () => queryClient.invalidateQueries({ queryKey: ['bot-knowledge'] })

// -- Crear / editar ---------------------------------------------------------

const modal = ref(false)
const editing = ref<KnowledgeEntry | null>(null)
const topic = ref('')
const answer = ref('')
const formError = ref<string | null>(null)

function openNew(): void {
  editing.value = null
  topic.value = ''
  answer.value = ''
  formError.value = null
  modal.value = true
}

function openEdit(entry: KnowledgeEntry): void {
  editing.value = entry
  topic.value = entry.topic
  answer.value = entry.answer
  formError.value = null
  modal.value = true
}

const { mutateAsync: save, isPending: saving } = useMutation({
  mutationFn: async () => {
    const body = { topic: topic.value.trim(), answer: answer.value.trim() }
    return editing.value
      ? httpClient.patch(`/bot/knowledge/${editing.value.id}`, body)
      : httpClient.post('/bot/knowledge', body)
  },
  onSuccess: refresh,
})

const canSave = computed(() => topic.value.trim().length >= 2 && answer.value.trim().length >= 2)

async function submit(): Promise<void> {
  formError.value = null
  try {
    await save()
    modal.value = false
    notify(editing.value ? 'Respuesta actualizada.' : 'El bot ya lo sabe.', 'success')
  } catch (e) {
    formError.value = extractErrorMessage(e, 'No pudimos guardarlo.')
  }
}

// -- Activar / borrar -------------------------------------------------------

const { mutateAsync: toggle } = useMutation({
  mutationFn: async (entry: KnowledgeEntry) =>
    httpClient.patch(`/bot/knowledge/${entry.id}`, { is_active: !entry.is_active }),
  onSuccess: refresh,
})

async function onToggle(entry: KnowledgeEntry): Promise<void> {
  try {
    await toggle(entry)
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos cambiarlo.'), 'error')
  }
}

const { mutateAsync: remove } = useMutation({
  mutationFn: async (entry: KnowledgeEntry) => httpClient.delete(`/bot/knowledge/${entry.id}`),
  onSuccess: refresh,
})

async function onDelete(entry: KnowledgeEntry): Promise<void> {
  if (!window.confirm(`¿Borrar «${entry.topic}»? El bot dejará de saberlo.`)) return
  try {
    await remove(entry)
    notify('Borrado.', 'success')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos borrarlo.'), 'error')
  }
}

const EJEMPLOS = [
  'Garantías: qué cubren, cuántos días, qué no cubren',
  'Parqueadero y cómo llegar',
  'Qué pasa si llego tarde',
  'Formas de pago',
]
</script>

<template>
  <section class="p-4 md:p-8">
    <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div class="max-w-2xl">
        <h1 class="text-xl font-semibold text-slate-800">Enséñale al bot</h1>
        <p class="mt-1 text-sm text-slate-500">
          Lo que el bot de WhatsApp responde por su cuenta. Escríbelo como se lo dirías a una
          clienta. Precios, horarios y citas <strong>no</strong> van aquí: esos el bot los consulta en
          vivo.
        </p>
      </div>
      <NxButton icon="pi pi-plus" @click="openNew">Agregar respuesta</NxButton>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p v-else-if="loadError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {{ extractErrorMessage(loadError, 'No pudimos cargar lo que sabe el bot.') }}
    </p>

    <div
      v-else-if="!entries?.length"
      class="max-w-2xl rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600"
    >
      <p class="font-medium text-slate-800">El bot todavía no sabe nada de tu negocio.</p>
      <p class="mt-1">Cuando le pregunten algo que no esté aquí, dirá que no lo sabe y ofrecerá que alguien le escriba. Empieza por lo que más te preguntan:</p>
      <ul class="mt-2 list-disc pl-5 text-slate-500">
        <li v-for="ejemplo in EJEMPLOS" :key="ejemplo">{{ ejemplo }}</li>
      </ul>
    </div>

    <ul v-else class="max-w-3xl divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      <li v-for="entry in entries" :key="entry.id" class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
        <div class="min-w-0 flex-1" :class="entry.is_active ? '' : 'opacity-50'">
          <p class="text-sm font-semibold text-slate-800">{{ entry.topic }}</p>
          <p class="mt-0.5 whitespace-pre-line text-sm text-slate-600">{{ entry.answer }}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span class="text-xs text-slate-500">{{ entry.is_active ? 'Activa' : 'Apagada' }}</span>
          <NxSwitch :model-value="entry.is_active" @update:model-value="onToggle(entry)" />
          <NxButton variant="ghost" size="sm" icon="pi pi-pencil" aria-label="Editar" @click="openEdit(entry)" />
          <NxButton variant="ghost" size="sm" icon="pi pi-trash" aria-label="Borrar" @click="onDelete(entry)" />
        </div>
      </li>
    </ul>

    <NxModal v-model="modal" :title="editing ? 'Editar respuesta' : 'Nueva respuesta'" size="md">
      <div class="flex flex-col gap-4">
        <NxInput v-model="topic" label="Tema (ej. Garantías)" required />
        <NxTextarea
          v-model="answer"
          label="Lo que responde el bot"
          :rows="6"
          required
          placeholder="Ej: Cubrimos 5 días el semipermanente y 10 el acrílico. Si se levanta, te lo rehacemos gratis con la misma manicurista. No cubre golpes ni uñas mordidas."
        />
        <p v-if="formError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ formError }}
        </p>
      </div>
      <template #footer>
        <NxButton variant="ghost" @click="modal = false">Cancelar</NxButton>
        <NxButton :loading="saving" :disabled="!canSave" @click="submit">Guardar</NxButton>
      </template>
    </NxModal>
  </section>
</template>
