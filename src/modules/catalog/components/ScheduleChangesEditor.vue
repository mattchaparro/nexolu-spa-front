<script setup lang="ts">
/*
 * Cambios de un día en el horario de una persona.
 *
 * «Hoy puede quedarse hasta las 9», «el viernes no trabaja desde el
 * mediodía», «mañana trabaja todo el día aunque no le toque». Antes el único
 * camino era tocar el horario semanal de toda la vida por un día. Aquí se
 * elige qué pasó, el día y las horas, y listo; el semanal no se toca.
 */
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { toLocalDateIso } from '@/utils/toLocalDateIso'
import { NxButton } from '@/ui'

import {
  useCreateScheduleChange,
  useDeleteScheduleChange,
  useScheduleChanges,
  type Schedule,
  type ScheduleChange,
} from '../composables/useCatalog'

const props = defineProps<{
  resourceId: number
  /** Su horario semanal, para proponer la hora en que normalmente sale. */
  weekly: Schedule[]
}>()

const { notify } = useSystemAlert()
const resourceId = computed(() => props.resourceId)
const { data: changes } = useScheduleChanges(resourceId)
const { mutateAsync: create, isPending: creating } = useCreateScheduleChange()
const { mutateAsync: remove } = useDeleteScheduleChange()

/** extra = trabaja más / otro día; off = quita horas (permiso, vacaciones). */
const mode = ref<'extra' | 'off'>('extra')
const date = ref(toLocalDateIso())
const endDate = ref('')
const allDay = ref(false)
const start = ref('17:00')
const end = ref('21:00')
const reason = ref('')
const error = ref<string | null>(null)
const warning = ref<ScheduleChange['conflicts']>([])

const today = toLocalDateIso()

/** ISO weekday (1 = lunes … 7 = domingo) de un YYYY-MM-DD. */
function weekdayOf(iso: string): number {
  const d = new Date(`${iso}T12:00:00`)
  return d.getDay() === 0 ? 7 : d.getDay()
}

function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.min(h * 60 + m + hours * 60, 23 * 60 + 59)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/*
 * Propone las horas según lo que ya trabaja ese día: si sale a las 5 y quiere
 * quedarse, lo natural es de 5 a 8; si ese día no trabaja, un día normal.
 */
function suggest(): void {
  if (mode.value === 'off') {
    start.value = '12:00'
    end.value = '18:00'
    return
  }

  const normal = props.weekly.find((s) => s.weekday === weekdayOf(date.value))

  if (normal) {
    start.value = normal.end_time.slice(0, 5)
    end.value = addHours(start.value, 3)
  } else {
    start.value = '09:00'
    end.value = '18:00'
  }
}

watch([mode, date], suggest, { immediate: true })

watch(allDay, (value) => {
  if (!value) endDate.value = ''
})

const canSave = computed(
  () =>
    !!date.value &&
    (allDay.value || (!!start.value && !!end.value && end.value > start.value)) &&
    (!endDate.value || endDate.value > date.value),
)

async function submit(): Promise<void> {
  error.value = null
  warning.value = []

  try {
    const saved = await create({
      resourceId: props.resourceId,
      kind: mode.value === 'extra' ? 'extra_hours' : 'block',
      date: date.value,
      ...(mode.value === 'off' && allDay.value
        ? { all_day: true, ...(endDate.value ? { end_date: endDate.value } : {}) }
        : { start_time: start.value, end_time: end.value }),
      ...(reason.value.trim() ? { reason: reason.value.trim() } : {}),
    })

    warning.value = saved.conflicts
    notify(
      mode.value === 'extra'
        ? 'Listo: ya aparecen esas horas disponibles.'
        : 'Listo: esas horas ya no se ofrecen.',
      'success',
    )
    reason.value = ''
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar el cambio.')
  }
}

async function destroy(change: ScheduleChange): Promise<void> {
  if (!window.confirm('¿Quitar este cambio? El horario de ese día vuelve a ser el normal.')) return

  try {
    await remove({ resourceId: props.resourceId, id: change.id })
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos quitarlo.'), 'error')
  }
}

function clock(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

function dayLabel(iso: string): string {
  const label = new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function describe(c: ScheduleChange): string {
  if (c.kind === 'extra_hours') return `Trabaja de ${clock(c.start_time)} a ${clock(c.end_time)}`
  if (c.all_day) {
    return c.end_date > c.date
      ? `No trabaja del ${dayLabel(c.date)} al ${dayLabel(c.end_date)}`
      : 'No trabaja en todo el día'
  }
  return `No trabaja de ${clock(c.start_time)} a ${clock(c.end_time)}`
}
</script>

<template>
  <div data-testid="schedule-changes">
    <p class="text-sm font-medium text-slate-700">Cambios de un día</p>
    <p class="mt-1 text-xs text-slate-500">
      Para algo puntual, sin tocar el horario de toda la semana: que se quede más tarde hoy, que
      trabaje un día que no le toca, o que tenga un permiso.
    </p>

    <div class="mt-3 flex flex-col gap-3 rounded-md border border-slate-200 p-3">
      <div class="grid grid-cols-2 gap-2" role="radiogroup">
        <button
          type="button"
          class="rounded-md border px-3 py-2 text-left text-sm"
          :class="
            mode === 'extra'
              ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
              : 'border-slate-200 text-slate-700'
          "
          data-testid="mode-extra"
          @click="mode = 'extra'"
        >
          <span class="block font-medium">Trabaja más horas</span>
          <span class="block text-xs opacity-80">Se queda más tarde o viene un día extra</span>
        </button>
        <button
          type="button"
          class="rounded-md border px-3 py-2 text-left text-sm"
          :class="
            mode === 'off'
              ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
              : 'border-slate-200 text-slate-700'
          "
          data-testid="mode-off"
          @click="mode = 'off'"
        >
          <span class="block font-medium">No trabaja</span>
          <span class="block text-xs opacity-80">Permiso, cita médica o vacaciones</span>
        </button>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <label class="text-xs text-slate-500">
          Día
          <input
            v-model="date"
            type="date"
            :min="today"
            class="mt-1 block rounded border border-slate-200 px-2 py-1 text-sm text-slate-800"
            data-testid="change-date"
          />
        </label>

        <template v-if="!(mode === 'off' && allDay)">
          <label class="text-xs text-slate-500">
            Desde
            <input
              v-model="start"
              type="time"
              class="mt-1 block rounded border border-slate-200 px-2 py-1 text-sm tabular-nums text-slate-800"
              data-testid="change-start"
            />
          </label>
          <label class="text-xs text-slate-500">
            Hasta
            <input
              v-model="end"
              type="time"
              class="mt-1 block rounded border border-slate-200 px-2 py-1 text-sm tabular-nums text-slate-800"
              data-testid="change-end"
            />
          </label>
        </template>

        <label v-if="mode === 'off' && allDay" class="text-xs text-slate-500">
          Hasta el día (opcional)
          <input
            v-model="endDate"
            type="date"
            :min="date"
            class="mt-1 block rounded border border-slate-200 px-2 py-1 text-sm text-slate-800"
          />
        </label>
      </div>

      <label v-if="mode === 'off'" class="flex items-center gap-2 text-sm text-slate-700">
        <input v-model="allDay" type="checkbox" data-testid="change-all-day" />
        Todo el día
      </label>

      <input
        v-model="reason"
        maxlength="120"
        placeholder="Motivo (opcional): clase, cita médica…"
        class="rounded border border-slate-200 px-2 py-1 text-sm text-slate-800"
      />

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div
        v-if="warning.length"
        class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        data-testid="change-conflicts"
      >
        <p class="font-medium">Ojo: tiene {{ warning.length }} cita(s) en esas horas.</p>
        <p class="text-xs">Quedan agendadas: reagéndalas o avísale a la clienta.</p>
        <ul class="mt-1 text-xs">
          <li v-for="c in warning" :key="c.appointment_id">
            {{ c.date }} {{ c.time }} · {{ c.client_name ?? 'Sin nombre' }} — {{ c.service_name }}
          </li>
        </ul>
      </div>

      <div class="flex justify-end">
        <NxButton
          size="sm"
          :loading="creating"
          :disabled="!canSave"
          data-testid="change-save"
          @click="submit"
        >
          Guardar cambio
        </NxButton>
      </div>
    </div>

    <div
      v-if="changes?.length"
      class="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200"
    >
      <div
        v-for="c in changes"
        :key="c.id"
        class="flex items-start justify-between gap-3 px-3 py-2"
        data-testid="change-row"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium text-slate-800">{{ dayLabel(c.date) }}</p>
          <p
            class="text-sm"
            :class="c.kind === 'extra_hours' ? 'text-emerald-700' : 'text-rose-700'"
          >
            {{ describe(c) }}
          </p>
          <p v-if="c.reason" class="text-xs text-slate-500">{{ c.reason }}</p>
          <p v-if="c.conflicts.length" class="text-xs text-amber-700">
            {{ c.conflicts.length }} cita(s) por reagendar
          </p>
        </div>
        <button type="button" class="shrink-0 text-xs text-red-600 underline" @click="destroy(c)">
          Quitar
        </button>
      </div>
    </div>
    <p v-else class="mt-3 text-xs text-slate-400">No hay cambios próximos.</p>
  </div>
</template>
