<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import type { GridAppointment, GridResource } from '../composables/useAgenda'
import { toMinutes, toTime } from '../composables/useAgenda'

const props = defineProps<{
  columns: Array<{
    key: string | number
    label: string
    sublabel?: string
    color?: string | null
    resource: GridResource
    /*
     * En la vista unida del telefono un bloque puede ser de cualquiera, asi
     * que tiene que decir de quien es. En las columnas por persona sobra: el
     * encabezado ya lo dice.
     */
    showWho?: boolean
    date: string
  }>
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

/**
 * Soltar termina el arrastre, haya caído donde haya caído.
 *
 * Función con nombre y no dos sentencias en el template: Prettier las parte en
 * dos líneas sin punto y coma y el compilador de plantillas las rechaza.
 */
function onDragEnd(): void {
  dragging.value = null
  hoverColumn.value = null
}

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

  // Misma regla que al tocar un espacio libre: soltar una cita encima del
  // almuerzo o fuera de la jornada la rebota el backend con 422. Mejor no
  // moverla en pantalla para volver a ponerla donde estaba un segundo después.
  const inWindow = column.resource.windows.some(
    (w) => minute >= toMinutes(w.start) && minute < toMinutes(w.end),
  )

  if (!inWindow) {
    dragging.value = null
    return
  }

  emit('move', {
    id: dragging.value.id,
    date: column.date,
    resourceId: column.resource.id,
    time: toTime(minute),
  })

  dragging.value = null
}

/** Lo ya atendido va en verde, como en el sistema viejo. */
function atendida(appointment: GridAppointment): boolean {
  return appointment.is_paid || appointment.status === 'completed'
}

function blockClass(appointment: GridAppointment): string {
  if (atendida(appointment)) {
    return 'border-emerald-400 bg-emerald-100 text-emerald-900'
  }

  return 'border-slate-200 bg-white text-slate-800'
}

/** El color de quien atiende, en el borde y de fondo suave. */
function blockStyle(appointment: GridAppointment, color: string | null | undefined): Record<string, string> {
  const tono = appointment.color ?? color
  if (atendida(appointment) || !tono) return {}

  return { borderLeft: `4px solid ${tono}`, backgroundColor: `${tono}1f` }
}

/*
 * Carriles: dos citas a la misma hora van lado a lado, no una encima de la
 * otra. En la vista general pasa todo el tiempo -- Alejandra y Marcela
 * atienden a la vez -- y encimadas no se podía leer ninguna.
 */
function carriles(citas: GridAppointment[]): Map<number, { carril: number; de: number }> {
  const orden = [...citas].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  const resultado = new Map<number, { carril: number; de: number }>()
  let grupo: GridAppointment[] = []
  let finGrupo = -1
  let finesPorCarril: number[] = []

  const cerrar = (): void => {
    const total = Math.max(1, finesPorCarril.length)
    for (const c of grupo) {
      const r = resultado.get(c.item_id)
      if (r) r.de = total
    }
    grupo = []
    finesPorCarril = []
  }

  for (const cita of orden) {
    const inicio = toMinutes(cita.start)
    const fin = toMinutes(cita.end)

    if (grupo.length && inicio >= finGrupo) cerrar()

    let carril = finesPorCarril.findIndex((f) => f <= inicio)
    if (carril === -1) {
      carril = finesPorCarril.length
      finesPorCarril.push(fin)
    } else {
      finesPorCarril[carril] = fin
    }

    resultado.set(cita.item_id, { carril, de: 1 })
    grupo.push(cita)
    finGrupo = grupo.length === 1 ? fin : Math.max(finGrupo, fin)
  }

  cerrar()

  return resultado
}

const carrilesPorColumna = computed(
  () => new Map(props.columns.map((c) => [c.key, carriles(c.resource.appointments)])),
)

function posicion(column: (typeof props.columns)[number], appointment: GridAppointment): Record<string, string> {
  const c = carrilesPorColumna.value.get(column.key)?.get(appointment.item_id) ?? { carril: 0, de: 1 }
  const ancho = 100 / c.de

  return {
    top: `${top(appointment.start)}px`,
    height: `${span(appointment.start, appointment.end)}px`,
    left: `calc(${c.carril * ancho}% + 2px)`,
    width: `calc(${ancho}% - 4px)`,
  }
}

/*
 * El scroll: la rejilla se desplaza por dentro, con los nombres arriba y las
 * horas a la izquierda siempre a la vista, y abre en la hora actual. Antes
 * se desplazaba la página entera y al bajar a la tarde ya no se sabía de
 * quién era cada columna.
 */
const scroller = ref<HTMLElement | null>(null)

function irALaHoraActual(): void {
  const ahora = new Date()
  const minuto = ahora.getHours() * 60 + ahora.getMinutes()
  if (!scroller.value || minuto < startMin.value || minuto > endMin.value) return
  scroller.value.scrollTop = Math.max(0, (minuto - startMin.value) * PX_PER_MIN - 120)
}

onMounted(() => nextTick(irALaHoraActual))
watch(() => props.columns.map((c) => c.date).join(), () => nextTick(irALaHoraActual))
</script>

<template>
  <div ref="scroller" class="max-h-[calc(100vh-13rem)] overflow-auto">
    <div class="flex min-w-full">
      <!-- Eje de horas: fijo a la izquierda al desplazarse de lado. -->
      <div class="sticky left-0 z-20 w-14 shrink-0 bg-white pt-9">
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
        class="min-w-[11rem] flex-1 border-l border-slate-200"
      >
        <!-- Los nombres fijos arriba al desplazarse hacia la tarde. -->
        <header
          class="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-slate-200 bg-white px-3"
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

          <!-- Almuerzo y descansos. Van encima de la franja laboral y con su
               nombre: un hueco gris sin explicación se lee igual que "ya
               salió", y alguien termina preguntándose por qué no puede
               agendar ahí. -->
          <div
            v-for="(rest, i) in column.resource.breaks ?? []"
            :key="`b-${i}`"
            class="pointer-events-none absolute inset-x-0 flex items-center justify-center overflow-hidden bg-slate-100/80"
            :style="windowStyle(rest)"
          >
            <span class="truncate px-1 text-[10px] uppercase tracking-wide text-slate-400">
              {{ rest.label }}
            </span>
          </div>

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
            class="absolute overflow-hidden rounded border px-1.5 py-0.5 text-xs shadow-sm"
            :class="[
              blockClass(appointment),
              canEdit && !appointment.is_paid ? 'cursor-grab' : 'cursor-pointer',
            ]"
            :style="{ ...posicion(column, appointment), ...blockStyle(appointment, column.color) }"
            @click.stop="emit('open', appointment)"
            @dragstart="dragging = appointment"
            @dragend="onDragEnd"
          >
            <p class="truncate font-medium">{{ appointment.client_name }}</p>
            <p class="truncate opacity-75">
              {{ appointment.start }} · {{ appointment.service_name }}
            </p>
            <p v-if="column.showWho" class="truncate text-[10px] opacity-60">
              {{ appointment.who }}
            </p>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>
