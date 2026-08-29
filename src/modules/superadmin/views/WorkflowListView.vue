<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton } from '@/ui'

import {
  useCreateWorkflow,
  useSaveWorkflowStages,
  useWorkflows,
  type StageAction,
  type Workflow,
  type WorkflowStage,
} from '../composables/usePlatform'

const { notify } = useSystemAlert()
const { data, isLoading } = useWorkflows()
const { mutateAsync: saveStages, isPending: saving } = useSaveWorkflowStages()
const { mutateAsync: createWorkflow, isPending: creating } = useCreateWorkflow()

const selectedId = ref<number | null>(null)
const error = ref<string | null>(null)

/** Copia editable de las etapas: se guarda en bloque, no fila por fila. */
const draft = ref<Array<Partial<WorkflowStage>>>([])

const workflows = computed<Workflow[]>(() => data.value?.workflows ?? [])
const selected = computed(() => workflows.value.find((w) => w.id === selectedId.value) ?? null)

watch(
  workflows,
  (list) => {
    if (selectedId.value === null && list.length) selectedId.value = list[0].id
  },
  { immediate: true },
)

watch(
  selected,
  (workflow) => {
    draft.value = (workflow?.stages ?? []).map((s) => ({ ...s, actions: [...s.actions] }))
    error.value = null
  },
  { immediate: true },
)

function statusLabel(value: string): string {
  return data.value?.statuses.find((s) => s.value === value)?.label ?? value
}

function addStage(): void {
  draft.value = [
    ...draft.value,
    {
      key: '',
      label: 'Etapa nueva',
      color: '#64748b',
      maps_to_status: data.value?.statuses[0]?.value ?? 'pending',
      is_initial: false,
      actions: [],
    },
  ]
}

function removeStage(index: number): void {
  draft.value = draft.value.filter((_, i) => i !== index)
}

function move(index: number, delta: number): void {
  const next = [...draft.value]
  const target = index + delta
  if (target < 0 || target >= next.length) return
  ;[next[index], next[target]] = [next[target], next[index]]
  draft.value = next
}

/** Solo una puede ser la de inicio: marcar otra desmarca la anterior. */
function setInitial(index: number): void {
  draft.value = draft.value.map((s, i) => ({ ...s, is_initial: i === index }))
}

function toggleAction(index: number, type: string): void {
  const stage = draft.value[index]
  const actions = (stage.actions ?? []) as StageAction[]
  const existing = actions.find((a) => a.type === type)

  draft.value = draft.value.map((s, i) =>
    i === index
      ? {
          ...s,
          actions: existing
            ? actions.filter((a) => a.type !== type)
            : [...actions, { type, config: {} }],
        }
      : s,
  )
}

function hasAction(stage: Partial<WorkflowStage>, type: string): boolean {
  return ((stage.actions ?? []) as StageAction[]).some((a) => a.type === type)
}

function templateOf(stage: Partial<WorkflowStage>, type: string): string {
  const action = ((stage.actions ?? []) as StageAction[]).find((a) => a.type === type)
  return (action?.config?.template as string) ?? ''
}

function setTemplate(index: number, type: string, value: string): void {
  draft.value = draft.value.map((s, i) =>
    i === index
      ? {
          ...s,
          actions: ((s.actions ?? []) as StageAction[]).map((a) =>
            a.type === type ? { ...a, config: { ...a.config, template: value } } : a,
          ),
        }
      : s,
  )
}

async function submit(): Promise<void> {
  if (!selected.value) return
  error.value = null

  try {
    await saveStages({ id: selected.value.id, stages: draft.value })
    notify('Flujo actualizado.', 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar el flujo.')
  }
}

const newName = ref('')

async function create(): Promise<void> {
  if (newName.value.trim().length < 3) return

  try {
    const created = await createWorkflow({ name: newName.value.trim() })
    newName.value = ''
    selectedId.value = created.id
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos crear el flujo.'), 'error')
  }
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Flujos de citas</h1>
      <p class="mt-1 max-w-3xl text-sm text-slate-500">
        Cómo llama cada negocio a los estados de una cita, y qué se dispara al entrar a cada etapa.
        Cada etapa apunta a uno de los seis estados del núcleo —de los que dependen la agenda, la
        caja y la nómina— y eso no se configura: un negocio que invente estados descuadra su propia
        plata sin saber por qué.
      </p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <div v-else class="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside class="self-start">
        <div class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          <button
            v-for="workflow in workflows"
            :key="workflow.id"
            type="button"
            class="flex w-full items-start gap-2 px-4 py-3 text-left transition hover:bg-slate-50"
            :class="workflow.id === selectedId ? 'bg-slate-50' : ''"
            @click="selectedId = workflow.id"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-slate-800">
                {{ workflow.name }}
              </span>
              <span class="block text-xs text-slate-500">
                {{ workflow.stages.length }} etapas ·
                {{ workflow.businesses_count }} negocio(s)
              </span>
            </span>
            <span
              v-if="workflow.is_default"
              class="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700"
            >
              inicial
            </span>
          </button>
        </div>

        <div class="mt-3 flex gap-2">
          <input
            v-model="newName"
            class="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-sm text-slate-800"
            placeholder="Flujo nuevo"
            :disabled="creating"
          />
          <NxButton size="sm" :loading="creating" @click="create">Crear</NxButton>
        </div>
      </aside>

      <div v-if="selected" class="min-w-0">
        <div class="space-y-3">
          <article
            v-for="(stage, index) in draft"
            :key="index"
            class="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div class="flex flex-wrap items-center gap-3">
              <input
                v-model="stage.color"
                type="color"
                class="h-7 w-9 shrink-0 rounded border border-slate-200 bg-transparent"
              />

              <input
                v-model="stage.label"
                class="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-sm text-slate-800"
                placeholder="Cómo lo llama el negocio"
              />

              <select
                v-model="stage.maps_to_status"
                class="rounded border border-slate-200 px-2 py-1 text-sm text-slate-800"
              >
                <option v-for="s in data?.statuses ?? []" :key="s.value" :value="s.value">
                  {{ s.label }}
                </option>
              </select>

              <label class="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                <input
                  type="radio"
                  :checked="stage.is_initial"
                  :name="`initial-${selected.id}`"
                  @change="setInitial(index)"
                />
                inicio
              </label>

              <div class="flex shrink-0 gap-1">
                <button type="button" class="px-1 text-slate-400 hover:text-slate-700" @click="move(index, -1)">↑</button>
                <button type="button" class="px-1 text-slate-400 hover:text-slate-700" @click="move(index, 1)">↓</button>
                <button type="button" class="px-1 text-slate-400 hover:text-red-600" @click="removeStage(index)">✕</button>
              </div>
            </div>

            <p class="mt-1 text-xs text-slate-500">
              Estado del núcleo: <b class="text-slate-700">{{ statusLabel(stage.maps_to_status ?? '') }}</b>
            </p>

            <!-- Acciones -->
            <div class="mt-3 border-t border-slate-100 pt-3">
              <p class="mb-2 text-xs uppercase tracking-wide text-slate-500">Al entrar a esta etapa</p>

              <div class="flex flex-wrap gap-2">
                <button
                  v-for="action in data?.actions ?? []"
                  :key="action.type"
                  type="button"
                  class="rounded-full border px-2.5 py-1 text-xs transition"
                  :class="
                    hasAction(stage, action.type)
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-400'
                  "
                  :title="action.help"
                  @click="toggleAction(index, action.type)"
                >
                  {{ action.label }}
                  <!-- Lo crítico se marca: si falla, la cita no se mueve. -->
                  <span v-if="action.critical" class="ml-1 text-amber-600">!</span>
                </button>
              </div>

              <div
                v-for="action in (data?.actions ?? []).filter(
                  (a) => a.config.includes('template') && hasAction(stage, a.type),
                )"
                :key="`t-${action.type}`"
                class="mt-3"
              >
                <label class="mb-1 block text-xs text-slate-500">
                  Mensaje de «{{ action.label }}»
                </label>
                <textarea
                  :value="templateOf(stage, action.type)"
                  rows="2"
                  class="w-full rounded border border-slate-200 px-2 py-1 text-sm text-slate-800"
                  placeholder="Si lo dejas vacío se usa un texto por defecto."
                  @input="setTemplate(index, action.type, ($event.target as HTMLTextAreaElement).value)"
                />
                <p class="mt-1 text-xs text-slate-500">
                  Puedes usar:
                  <code
                    v-for="ph in data?.placeholders ?? []"
                    :key="ph"
                    class="ml-1 rounded bg-slate-100 px-1 text-slate-600"
                  >{{ '{' + ph + '}' }}</code>
                </p>
              </div>
            </div>
          </article>
        </div>

        <p v-if="error" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </p>

        <div class="mt-4 flex items-center gap-3">
          <NxButton variant="secondary" @click="addStage">Agregar etapa</NxButton>
          <NxButton :loading="saving" @click="submit">Guardar flujo</NxButton>
          <p v-if="selected.businesses_count > 0" class="text-xs text-amber-700">
            Lo usan {{ selected.businesses_count }} negocio(s). Borrar una etapa no cambia el estado
            de las citas que estaban en ella.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
