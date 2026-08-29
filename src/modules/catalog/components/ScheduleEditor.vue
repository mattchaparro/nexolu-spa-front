<script setup lang="ts">
import { ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxModal } from '@/ui'

import {
  useSaveSchedules,
  useSchedules,
  WEEKDAYS,
  type TeamResource,
} from '../composables/useCatalog'

const props = defineProps<{ resource: TeamResource | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const resourceId = ref<number | null>(null)
watch(() => props.resource, (r) => { resourceId.value = r?.id ?? null }, { immediate: true })

const { data: existing } = useSchedules(resourceId)
const { mutateAsync, isPending } = useSaveSchedules()

/** Un día activo o no, con su franja. La semana entera, siempre. */
interface DayRow {
  weekday: number
  label: string
  enabled: boolean
  start: string
  end: string
}

const days = ref<DayRow[]>([])
const error = ref<string | null>(null)

watch(
  existing,
  (schedules) => {
    days.value = WEEKDAYS.map((day) => {
      const match = schedules?.find((s) => s.weekday === day.value)

      return {
        weekday: day.value,
        label: day.label,
        enabled: Boolean(match),
        start: match?.start_time ?? '09:00',
        end: match?.end_time ?? '18:00',
      }
    })
  },
  { immediate: true },
)

/** Copiar la franja del primer día activo al resto: casi siempre es la misma. */
function copyToAll(): void {
  const first = days.value.find((d) => d.enabled)

  if (!first) {
    return
  }

  days.value = days.value.map((d) => (d.enabled ? { ...d, start: first.start, end: first.end } : d))
}

async function submit(): Promise<void> {
  if (!props.resource) {
    return
  }

  error.value = null

  const invalid = days.value.find((d) => d.enabled && d.end <= d.start)

  if (invalid) {
    error.value = `El ${invalid.label.toLowerCase()} termina antes de empezar.`
    return
  }

  try {
    await mutateAsync({
      resourceId: props.resource.id,
      schedules: days.value
        .filter((d) => d.enabled)
        .map((d) => ({ weekday: d.weekday, start_time: d.start, end_time: d.end })),
    })
    emit('saved')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar el horario.')
  }
}
</script>

<template>
  <NxModal
    :model-value="resource !== null"
    :title="`Horario de ${resource?.name ?? ''}`"
    @update:model-value="emit('close')"
  >
    <div class="flex flex-col gap-4">
      <p class="text-sm text-slate-500">
        Marca los días que trabaja y su franja. Los descansos puntuales y las
        vacaciones se manejan aparte, sin tocar este horario.
      </p>

      <div class="divide-y divide-slate-100 rounded-md border border-slate-200">
        <div v-for="day in days" :key="day.weekday" class="flex items-center gap-3 px-3 py-2">
          <input
            :id="`d-${day.weekday}`"
            v-model="day.enabled"
            type="checkbox"
            :disabled="isPending"
          />
          <label :for="`d-${day.weekday}`" class="w-24 text-sm text-slate-700">{{ day.label }}</label>

          <template v-if="day.enabled">
            <input
              v-model="day.start"
              type="time"
              class="rounded border border-slate-200 px-2 py-1 text-sm tabular-nums"
              :disabled="isPending"
            />
            <span class="text-slate-400">a</span>
            <input
              v-model="day.end"
              type="time"
              class="rounded border border-slate-200 px-2 py-1 text-sm tabular-nums"
              :disabled="isPending"
            />
          </template>
          <span v-else class="text-sm text-slate-400">Descansa</span>
        </div>
      </div>

      <button
        type="button"
        class="self-start text-sm text-indigo-600 underline"
        :disabled="isPending"
        @click="copyToAll"
      >
        Usar la misma franja todos los días
      </button>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <NxButton variant="secondary" :disabled="isPending" @click="emit('close')">Cancelar</NxButton>
        <NxButton :loading="isPending" @click="submit">Guardar horario</NxButton>
      </div>
    </div>
  </NxModal>
</template>
