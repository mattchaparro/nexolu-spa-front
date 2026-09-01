<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * Calendario de un mes, propio.
 *
 * No es `<input type="date">` a propósito: en el navegador embebido de
 * WhatsApp ese control abre un selector distinto en cada teléfono -- rueditas
 * en iOS, diálogo del sistema en Android, y en algunos ni abre -- y no hay
 * forma de apagarle los días sin disponibilidad. Un calendario propio se ve
 * igual en todas partes y puede mostrar en gris los días que no sirven, que es
 * la mitad del valor de mostrarlo.
 */
const props = defineProps<{
  /** Día elegido, en `YYYY-MM-DD`. */
  modelValue: string | null
  /** `YYYY-MM-DD` → si ese día tiene algo libre. Lo que no esté, se asume sin datos. */
  available: Record<string, boolean>
  /** Antes de este día no se puede reservar. */
  min: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** Primer día del mes que se está mirando: el padre pide su disponibilidad. */
  'month-change': [from: string]
}>()

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** El mes visible, siempre como su día 1. */
const cursor = ref(firstOfMonth(props.modelValue ?? props.min))

function firstOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const year = computed(() => Number(cursor.value.slice(0, 4)))
const month = computed(() => Number(cursor.value.slice(5, 7)) - 1)

const title = computed(() => `${MESES[month.value]} ${year.value}`)

/**
 * Las casillas del mes, con los huecos del principio.
 *
 * La semana arranca en lunes: es como se lee un calendario acá, y empezarlo en
 * domingo hace que la gente toque el día equivocado.
 */
const cells = computed<Array<{ iso: string; day: number } | null>>(() => {
  const primero = new Date(`${cursor.value}T12:00:00`)
  // getDay() da 0 para domingo; se corre para que lunes sea 0.
  const arranque = (primero.getDay() + 6) % 7
  const ultimo = new Date(year.value, month.value + 1, 0).getDate()

  const result: Array<{ iso: string; day: number } | null> = Array(arranque).fill(null)

  for (let day = 1; day <= ultimo; day++) {
    result.push({ iso: iso(year.value, month.value, day), day })
  }

  return result
})

/**
 * Un día se puede tocar salvo que sepamos que no sirve.
 *
 * Mientras el padre trae la disponibilidad, los días futuros siguen tocables:
 * apagarlos por no tener el dato todavía haría parpadear el mes entero en gris
 * en cada cambio, que se lee como "no hay nada" cuando sí hay.
 */
function selectable(day: string): boolean {
  if (day < props.min) {
    return false
  }

  return props.available[day] !== false
}

const puedeAtras = computed(() => cursor.value > firstOfMonth(props.min))

function move(delta: number): void {
  const next = new Date(year.value, month.value + delta, 1)
  cursor.value = iso(next.getFullYear(), next.getMonth(), 1)
  emit('month-change', cursor.value)
}

// Elegir un día desde afuera (las fichas rápidas) trae el mes a la vista.
watch(
  () => props.modelValue,
  (value) => {
    if (value && firstOfMonth(value) !== cursor.value) {
      cursor.value = firstOfMonth(value)
    }
  },
)
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white p-3">
    <div class="mb-2 flex items-center justify-between">
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 disabled:opacity-25"
        :disabled="!puedeAtras"
        aria-label="Mes anterior"
        @click="move(-1)"
      >
        ‹
      </button>

      <p class="text-sm font-medium capitalize text-slate-800">
        {{ title }}
        <span v-if="loading" class="ml-1 text-xs font-normal text-slate-400">·</span>
      </p>

      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500"
        aria-label="Mes siguiente"
        @click="move(1)"
      >
        ›
      </button>
    </div>

    <div class="grid grid-cols-7 gap-1">
      <span
        v-for="(d, i) in DIAS"
        :key="i"
        class="pb-1 text-center text-[11px] font-medium text-slate-400"
      >
        {{ d }}
      </span>

      <template v-for="(cell, i) in cells" :key="i">
        <span v-if="cell === null" />

        <button
          v-else
          type="button"
          class="flex h-11 items-center justify-center rounded-lg text-sm transition"
          :class="
            modelValue === cell.iso
              ? 'bg-slate-900 font-semibold text-white'
              : selectable(cell.iso)
                ? 'text-slate-700 hover:bg-slate-100'
                : 'text-slate-300'
          "
          :disabled="!selectable(cell.iso)"
          @click="emit('update:modelValue', cell.iso)"
        >
          {{ cell.day }}
        </button>
      </template>
    </div>
  </div>
</template>
