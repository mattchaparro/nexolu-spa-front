<script setup lang="ts">
import { computed, ref, toRef } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'

import {
  useMoveStage,
  useStageOptions,
  type StageActionOutcome,
  type StageOption,
} from '../composables/useAppointments'

const props = defineProps<{ appointmentId: number }>()

const { data, isLoading } = useStageOptions(toRef(props, 'appointmentId'))
const { mutateAsync: move, isPending } = useMoveStage()

const error = ref<string | null>(null)
/** Lo que se disparó en el último movimiento. Se muestra y se olvida. */
const outcomes = ref<StageActionOutcome[]>([])

const options = computed<StageOption[]>(() => data.value?.options ?? [])

async function pick(option: StageOption): Promise<void> {
  error.value = null
  outcomes.value = []

  try {
    const result = await move({
      id: props.appointmentId,
      stageId: option.stage_id,
      status: option.stage_id === null ? option.maps_to_status : undefined,
    })

    // Lo que se disparó se muestra acá y no en un toast que se va solo: si el
    // WhatsApp no salió, quien movió la cita tiene que enterarse ahora.
    outcomes.value = result.actions ?? []
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos mover la cita.')
  }
}

function outcomeClass(status: StageActionOutcome['status']): string {
  if (status === 'ok') return 'text-emerald-700'
  if (status === 'failed') return 'text-red-700'
  return 'text-slate-500'
}

function outcomeIcon(status: StageActionOutcome['status']): string {
  if (status === 'ok') return '✓'
  if (status === 'failed') return '✕'
  return '·'
}
</script>

<template>
  <div>
    <p class="mb-2 text-xs uppercase tracking-wide text-slate-400">
      Estado
      <span v-if="data" class="ml-1 normal-case tracking-normal text-slate-600">
        · {{ data.current.status_label }}
      </span>
    </p>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p v-else-if="!options.length" class="text-sm text-slate-500">
      Esta cita ya no se puede mover de estado.
    </p>

    <div v-else class="flex flex-wrap gap-2">
      <button
        v-for="option in options"
        :key="option.key"
        type="button"
        class="rounded-full border px-3 py-1 text-sm transition disabled:opacity-50"
        :style="option.color ? { borderColor: option.color, color: option.color } : undefined"
        :class="option.color ? '' : 'border-slate-200 text-slate-700 hover:border-slate-400'"
        :disabled="isPending"
        @click="pick(option)"
      >
        {{ option.label }}
      </button>
    </div>

    <ul v-if="outcomes.length" class="mt-3 space-y-1">
      <li v-for="(outcome, i) in outcomes" :key="i" class="text-xs" :class="outcomeClass(outcome.status)">
        {{ outcomeIcon(outcome.status) }} {{ outcome.label }}
        <span v-if="outcome.detail" class="text-slate-500">— {{ outcome.detail }}</span>
      </li>
    </ul>

    <p v-if="error" class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>
  </div>
</template>
