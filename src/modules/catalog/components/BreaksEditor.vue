<script setup lang="ts">
import { computed, ref, toRef } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton } from '@/ui'

import {
  useBreaks,
  useDeleteBreak,
  useSaveBreak,
  WEEKDAYS,
  type ResourceBreak,
} from '../composables/useCatalog'

const props = defineProps<{ resourceId: number; resourceName: string }>()

const { notify } = useSystemAlert()
const { data: breaks } = useBreaks(toRef(props, 'resourceId'))
const { mutateAsync: save, isPending: saving } = useSaveBreak()
const { mutateAsync: remove } = useDeleteBreak()

const adding = ref(false)
const label = ref('Almuerzo')
const start = ref('13:00')
const end = ref('14:00')
const weekday = ref<number | null>(null)
const error = ref<string | null>(null)

const rows = computed(() => breaks.value ?? [])

function dayLabel(row: ResourceBreak): string {
  if (row.weekday === null) return 'Todos los días'
  return WEEKDAYS.find((d) => d.value === row.weekday)?.label ?? ''
}

function reset(): void {
  label.value = 'Almuerzo'
  start.value = '13:00'
  end.value = '14:00'
  weekday.value = null
  error.value = null
}

async function submit(): Promise<void> {
  error.value = null

  if (end.value <= start.value) {
    error.value = 'El descanso termina antes de empezar.'
    return
  }

  try {
    await save({
      payload: {
        resource_id: props.resourceId,
        weekday: weekday.value,
        start_time: start.value,
        end_time: end.value,
        label: label.value.trim() || 'Almuerzo',
      },
    })
    adding.value = false
    reset()
    notify('Descanso guardado.', 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar el descanso.')
  }
}

async function destroy(row: ResourceBreak): Promise<void> {
  if (!window.confirm(`¿Quitar "${row.label}" de ${row.start_time} a ${row.end_time}?`)) return

  try {
    await remove(row.id)
    notify('Descanso eliminado.', 'success')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos eliminarlo.'), 'error')
  }
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <p class="text-sm font-medium text-slate-800">Almuerzo y descansos</p>
      <NxButton v-if="!adding" variant="ghost" size="sm" @click="adding = true">Agregar</NxButton>
    </div>

    <p class="mb-3 text-xs text-slate-500">
      Horas del día laboral en las que no se atiende. No aparecen como disponibles y
      <b>no se pueden pisar</b>: ni con horas extra, ni agendando a mano, ni arrastrando en el
      calendario. Si un día hay que trabajar en esa franja, se cambia el descanso.
    </p>

    <div class="divide-y divide-slate-100 rounded-md border border-slate-200">
      <p v-if="!rows.length && !adding" class="px-3 py-4 text-center text-sm text-slate-500">
        Sin descansos. {{ resourceName }} atiende toda su jornada.
      </p>

      <div v-for="row in rows" :key="row.id" class="flex items-center gap-3 px-3 py-2">
        <span class="min-w-0 flex-1">
          <span class="block text-sm text-slate-800">
            {{ row.label }}
            <span class="ml-1 tabular-nums text-slate-500">
              {{ row.start_time }}–{{ row.end_time }}
            </span>
          </span>
          <span class="block text-xs text-slate-500">
            {{ dayLabel(row) }}
            <!-- Uno del negocio entero se ve acá pero se edita en otro lado:
                 tocarlo desde la ficha de una profesional lo cambiaría para
                 todas sin que quien lo hace se entere. -->
            <span v-if="row.scope === 'business'" class="ml-1 text-amber-700">
              · de todo el equipo
            </span>
          </span>
        </span>

        <button
          v-if="row.scope === 'resource'"
          type="button"
          class="shrink-0 text-xs text-slate-400 hover:text-red-600"
          @click="destroy(row)"
        >
          Quitar
        </button>
      </div>

      <div v-if="adding" class="flex flex-col gap-3 bg-slate-50 px-3 py-3">
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="label"
            class="w-36 rounded border border-slate-200 px-2 py-1 text-sm"
            placeholder="Almuerzo"
            :disabled="saving"
          />
          <input
            v-model="start"
            type="time"
            class="rounded border border-slate-200 px-2 py-1 text-sm tabular-nums"
            :disabled="saving"
          />
          <span class="text-slate-400">a</span>
          <input
            v-model="end"
            type="time"
            class="rounded border border-slate-200 px-2 py-1 text-sm tabular-nums"
            :disabled="saving"
          />
        </div>

        <select
          v-model="weekday"
          class="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          :disabled="saving"
        >
          <option :value="null">Todos los días</option>
          <option v-for="day in WEEKDAYS" :key="day.value" :value="day.value">
            Solo los {{ day.label.toLowerCase() }}
          </option>
        </select>

        <p v-if="error" class="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{{ error }}</p>

        <div class="flex justify-end gap-2">
          <NxButton
            variant="secondary"
            size="sm"
            :disabled="saving"
            @click="adding = false; reset()"
          >
            Cancelar
          </NxButton>
          <NxButton size="sm" :loading="saving" @click="submit">Guardar</NxButton>
        </div>
      </div>
    </div>
  </div>
</template>
