<script setup lang="ts">
import { computed, ref } from 'vue'

import type { GridAppointment, GridResource } from '../composables/useAgenda'
import { toMinutes, toTime } from '../composables/useAgenda'

const props = defineProps<{
  columns: Array<{ key: string | number; label: string; sublabel?: string; color?: string | null; resource: GridResource; date: string }>
  dayStart: string
  dayEnd: string
  granularity: number
  canEdit: boolean
}>()

const emit = defineEmits<{
  pick: [payload: { date: string; resourceId: number; time: string }]
  open: [appointment: GridAppointment]
  move: [payload: { id: number; date: string; resourceId: number; time: string }]
}>()

/** Pixeles por minuto. Con 1.1 una hora mide 66px: legible sin scroll eterno. */
const PX_PER_MIN = 1.1

const startMin = computed(() => toMinutes(props.dayStart))
const endMin = computed(() => toMinutes(props.dayEnd))
const height = computed(() => (endMin.value - startMin.value) * PX_PER_MIN)

/** Marcas de hora en punto para el eje. */
const hourMarks = computed(() => {
  const marks: Array<{ minute: number; label: string }> = []
  const first = Math.ceil(startMin.value / 60) * 60

  for (let m = first; m <= endMin.value; m += 60) {
    marks.push({ minute: m, label: toTime(m) })
  }

  return marks
})

function top(time: string): number {
  return (toMinutes(time) - startMin.value) * PX_PER_MIN
}

function span(from: string, to: string): number {
  return Math.max(18, (toMinutes(to) - toMinutes(from)) * PX_PER_MIN)
}

/** Franja laboral pintada de fondo: fuera de ella no se agenda. */
function windowStyle(window: { start: string; end: string }) {
  return { top: `${top(window.start)}px`, height: `${span(window.start, window.end)}px` }
}

const dragging = ref<GridAppointment | null>(null)
const hoverColumn = ref<string | number | null>(null)

/** Minuto de la rejilla bajo el cursor, redondeado a la granularidad. */
function minuteFromEvent(event: MouseEvent | DragEvent, element: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  const raw = startMin.value + (event.clientY - rect.top) / PX_PER_MIN
  const snapped = Math.round(raw / props.granularity) * props.granularity

  return Math.min(Math.max(snapped, startMin.value), endMin.value)
}

function onGridClick(event: MouseEvent, column: (typeof props.columns)[number]): void {
  if (!props.canEdit) {
    return
  }

  const minute = minuteFromEvent(event, event.currentTarget as HTMLElement)

  // Solo dentro de la franja laboral: ofrecer un hueco a las 3am seria
  // aceptar una cita que el motor va a rechazar despues.
  const inWindow = column.resource.windows.some(
    (w) => minute >= toMinutes(w.start) && minute < toMinutes(w.end),
  )

  if (!inWindow) {
    return
  }

  emit('pick', { date: column.date, resourceId: column.resource.id, time: toTime(minute) })
}

function onDrop(event: DragEvent, column: (typeof props.columns)[number]): void {
  hoverColumn.value = null

  if (!dragging.value || !props.canEdit) {
    return
  }

  const minute = minuteFromEvent(event, event.currentTarget as HTMLElement)

  emit('move', {
    id: dragging.value.id,
    date: column.date,
    resourceId: column.resource.id,
    time: toTime(minute),
  })

  dragging.value = null
}

function blockClass(appointment: GridAppointment): string {
  if (appointment.is_paid) {
    return 'border-emerald-300 bg-emerald-50 text-emerald-900'
  }

  return appointment.status === 'confirmed'
    ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
    : 'border-slate-300 bg-white text-slate-800'
}
</script>

<template>
  <div class="overflow-x-auto">
    <div class="flex min-w-max">
      <!-- Eje de horas -->
      <div class="w-14 shrink-0 pt-9">
        <div class="relative" :style="{ height: `${height}px` }">
          <div
            v-for="mark in hourMarks"
            :key="mark.minute"
            class="absolute -translate-y-1/2 pr-2 text-right text-xs tabular-nums text-slate-400"
            :style="{ top: `${(mark.minute - startMin) * PX_PER_MIN}px`, width: '100%' }"
          >
            {{ mark.label }}
          </div>
        </div>
      </div>

      <div
        v-for="column in columns"
        :key="column.key"
        class="w-48 shrink-0 border-l border-slate-200"
      >
        <header
          class="flex h-9 items-center gap-2 border-b border-slate-200 px-3"
          :style="column.color ? { borderTop: `3px solid ${column.color}` } : undefined"
        >
          <span class="truncate text-sm font-medium text-slate-700">{{ column.label }}</span>
          <span v-if="column.sublabel" class="text-xs text-slate-400">{{ column.sublabel }}</span>
        </header>

        <div
          class="relative bg-slate-50"
          :class="{ 'bg-indigo-50/50': hoverColumn === column.key }"
          :style="{ height: `${height}px` }"
          @click="onGridClick($event, column)"
          @dragover.prevent="hoverColumn = column.key"
          @dragleave="hoverColumn = null"
          @drop.prevent="onDrop($event, column)"
        >
          <!-- Franja laboral -->
          <div
            v-for="(window, i) in column.resource.windows"
            :key="i"
            class="absolute inset-x-0 bg-white"
            :style="windowStyle(window)"
          />

          <!-- Líneas de hora -->
          <div
            v-for="mark in hourMarks"
            :key="`l-${mark.minute}`"
            class="pointer-events-none absolute inset-x-0 border-t border-slate-100"
            :style="{ top: `${(mark.minute - startMin) * PX_PER_MIN}px` }"
          />

          <!-- Citas -->
          <article
            v-for="appointment in column.resource.appointments"
            :key="appointment.item_id"
            :draggable="canEdit && !appointment.is_paid"
            class="absolute inset-x-1 overflow-hidden rounded border px-1.5 py-0.5 text-xs shadow-sm"
            :class="[blockClass(appointment), canEdit && !appointment.is_paid ? 'cursor-grab' : 'cursor-pointer']"
            :style="{ top: `${top(appointment.start)}px`, height: `${span(appointment.start, appointment.end)}px` }"
            @click.stop="emit('open', appointment)"
            @dragstart="dragging = appointment"
            @dragend="dragging = null; hoverColumn = null"
          >
            <p class="truncate font-medium">{{ appointment.client_name }}</p>
            <p class="truncate opacity-75">{{ appointment.start }} · {{ appointment.service_name }}</p>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>
