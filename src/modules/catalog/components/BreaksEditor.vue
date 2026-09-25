<script setup lang="ts">
import { computed, ref, toRef } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { toLocalDateIso } from '@/utils/toLocalDateIso'
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

/*
 * Siempre, o solo unas fechas.
 *
 * «Hoy a las 3 Marcela no», «el viernes 2 no viene», «del 10 al 15 está de
 * vacaciones»: un bloqueo de una vez, no una regla de todas las semanas.
 * Con «todo el día» se tapa la jornada entera.
 */
const cuando = ref<'siempre' | 'fechas'>('siempre')
const desde = ref(toLocalDateIso())
const hasta = ref(toLocalDateIso())
const todoElDia = ref(false)

const rows = computed(() => breaks.value ?? [])

function fecha(iso: string): string {
  return new Date(`${iso}T12:00`).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function dayLabel(row: ResourceBreak): string {
  // Con fecha de fin es un bloqueo de una vez, no una regla semanal.
  if (row.effective_to) {
    const inicio = row.effective_from ?? row.effective_to
    return inicio === row.effective_to
      ? `Solo el ${fecha(inicio)}`
      : `Del ${fecha(inicio)} al ${fecha(row.effective_to)}`
  }
  if (row.weekday === null) return 'Todos los días'
  return WEEKDAYS.find((d) => d.value === row.weekday)?.label ?? ''
}

/** Un bloqueo que ya pasó: se ve apagado, no se esconde. */
function vencido(row: ResourceBreak): boolean {
  return row.effective_to !== null && row.effective_to < toLocalDateIso()
}

function reset(): void {
  label.value = 'Almuerzo'
  start.value = '13:00'
  end.value = '14:00'
  weekday.value = null
  error.value = null
  cuando.value = 'siempre'
  desde.value = toLocalDateIso()
  hasta.value = toLocalDateIso()
  todoElDia.value = false
}

/*
 * Cerrar el formulario sin guardar.
 *
 * Función con nombre y no dos sentencias en el template: Prettier las parte en
 * dos líneas sin punto y coma y el compilador de plantillas rechaza el archivo
 * entero. Ya pasó tres veces en este repo.
 */
function cancelar(): void {
  adding.value = false
  reset()
}

async function submit(): Promise<void> {
  error.value = null

  const porFechas = cuando.value === 'fechas'
  const inicio = porFechas && todoElDia.value ? '00:00' : start.value
  const fin = porFechas && todoElDia.value ? '23:59' : end.value

  if (fin <= inicio) {
    error.value = 'El descanso termina antes de empezar.'
    return
  }

  if (porFechas && hasta.value < desde.value) {
    error.value = 'La fecha final es antes de la inicial.'
    return
  }

  try {
    await save({
      payload: {
        resource_id: props.resourceId,
        weekday: porFechas ? null : weekday.value,
        start_time: inicio,
        end_time: fin,
        label: label.value.trim() || (porFechas ? 'Bloqueo' : 'Almuerzo'),
        ...(porFechas ? { effective_from: desde.value, effective_to: hasta.value } : {}),
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
      <p class="text-sm font-medium text-slate-800">Almuerzo, descansos y bloqueos</p>
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

      <div
        v-for="row in rows"
        :key="row.id"
        class="flex items-center gap-3 px-3 py-2"
        :class="{ 'opacity-50': vencido(row) }"
      >
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
                 tocarlo desde la ficha de una persona lo cambiaría para
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
        <!-- Siempre (una regla de todas las semanas) o solo unas fechas. -->
        <div class="flex gap-1 rounded-md bg-white p-0.5 text-sm ring-1 ring-slate-200">
          <button
            type="button"
            class="flex-1 rounded px-2 py-1"
            :class="cuando === 'siempre' ? 'bg-slate-800 text-white' : 'text-slate-600'"
            @click="cuando = 'siempre'"
          >
            Siempre
          </button>
          <button
            type="button"
            class="flex-1 rounded px-2 py-1"
            :class="cuando === 'fechas' ? 'bg-slate-800 text-white' : 'text-slate-600'"
            @click="cuando = 'fechas'"
          >
            En fechas
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="label"
            class="w-36 rounded border border-slate-200 px-2 py-1 text-sm"
            :placeholder="cuando === 'fechas' ? 'Bloqueo' : 'Almuerzo'"
            :disabled="saving"
          />
          <template v-if="!(cuando === 'fechas' && todoElDia)">
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
          </template>
        </div>

        <select
          v-if="cuando === 'siempre'"
          v-model="weekday"
          class="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          :disabled="saving"
        >
          <option :value="null">Todos los días</option>
          <option v-for="day in WEEKDAYS" :key="day.value" :value="day.value">
            Solo los {{ day.label.toLowerCase() }}
          </option>
        </select>

        <template v-else>
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <span class="text-slate-500">Desde</span>
            <input
              v-model="desde"
              type="date"
              class="rounded border border-slate-200 px-2 py-1 tabular-nums"
              :disabled="saving"
              @change="hasta < desde && (hasta = desde)"
            />
            <span class="text-slate-500">hasta</span>
            <input
              v-model="hasta"
              type="date"
              :min="desde"
              class="rounded border border-slate-200 px-2 py-1 tabular-nums"
              :disabled="saving"
            />
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="todoElDia" type="checkbox" :disabled="saving" />
            Todo el día (no atiende)
          </label>
        </template>

        <p v-if="error" class="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{{ error }}</p>

        <div class="flex justify-end gap-2">
          <NxButton variant="secondary" size="sm" :disabled="saving" @click="cancelar">
            Cancelar
          </NxButton>
          <NxButton size="sm" :loading="saving" @click="submit">Guardar</NxButton>
        </div>
      </div>
    </div>
  </div>
</template>
