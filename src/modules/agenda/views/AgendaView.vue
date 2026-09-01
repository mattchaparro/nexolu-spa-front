<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useLocations } from '@/modules/settings/composables/useLocations'
import { useAuthStore } from '@/stores/auth.store'
import { NxButton, NxDatePicker } from '@/ui'

import BookSlotModal, { type SlotPick } from '../components/BookSlotModal.vue'
import CalendarGrid from '../components/CalendarGrid.vue'
import CheckoutModal from '../components/CheckoutModal.vue'
import { useAgenda, useReschedule, type GridAppointment } from '../composables/useAgenda'
import { useAppointments, type Appointment } from '../composables/useAppointments'
import { useServices } from '../composables/useAvailability'

const auth = useAuthStore()
const { notify } = useSystemAlert()

type View = 'day' | 'week'

const view = ref<View>('day')
const anchor = ref(new Date().toISOString().slice(0, 10))
const focusedResourceId = ref<number | null>(null)

const pick = ref<SlotPick | null>(null)
const toCheckout = ref<Appointment | null>(null)

const granularity = computed(() => auth.business?.scheduling_settings?.slot_granularity_min ?? 15)
const canEdit = computed(() => auth.can('citas.crear') && auth.can('citas.editar'))

/** Lunes de la semana del ancla: la semana laboral se lee de lunes a domingo. */
function mondayOf(iso: string): string {
  const date = new Date(`${iso}T12:00:00`)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return date.toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const from = computed(() => (view.value === 'day' ? anchor.value : mondayOf(anchor.value)))
const to = computed(() => (view.value === 'day' ? null : addDays(mondayOf(anchor.value), 6)))

/*
 * Qué sede se está mirando.
 *
 * Arranca en null -- todas -- y un watch la fija en la principal apenas se
 * sabe que hay más de una. Con un solo local el selector ni aparece y la
 * agenda se comporta igual que antes de que existieran las sedes.
 *
 * La elección se recuerda en el navegador porque quien administra dos
 * locales entra siempre al mismo, y tener que elegirlo cada mañana es una
 * fricción diaria por una decisión que casi nunca cambia.
 */
const RECUERDO_SEDE = 'nexolu.agenda.sede'

const locationId = ref<number | null>(leerSedeRecordada())

function leerSedeRecordada(): number | null {
  try {
    const guardada = window.localStorage.getItem(RECUERDO_SEDE)
    return guardada ? Number(guardada) : null
  } catch {
    // Navegación privada, o cookies bloqueadas. No es un error: se cae al
    // comportamiento de siempre.
    return null
  }
}

const { data: locationsData } = useLocations()

const sedes = computed(() => (locationsData.value?.locations ?? []).filter((l) => l.is_active))
const variasSedes = computed(() => sedes.value.length > 1)

watch(
  sedes,
  (lista) => {
    if (lista.length < 2) {
      // Volvió a haber un solo local: la rejilla las trae todas otra vez.
      locationId.value = null
      return
    }

    // La sede recordada puede haberse apagado desde otro dispositivo.
    if (locationId.value && lista.some((l) => l.id === locationId.value)) return

    locationId.value = (lista.find((l) => l.is_primary) ?? lista[0]).id
  },
  { immediate: true },
)

watch(locationId, (id) => {
  try {
    if (id) window.localStorage.setItem(RECUERDO_SEDE, String(id))
    else window.localStorage.removeItem(RECUERDO_SEDE)
  } catch {
    // Recordarlo es una comodidad, no un requisito.
  }
})

const { data: agenda, isFetching } = useAgenda(from, to, locationId)
const { data: services } = useServices()
const { data: dayAppointments } = useAppointments(anchor)
const { mutateAsync: reschedule } = useReschedule()

const staff = computed(() => agenda.value?.days[0]?.resources ?? [])

/**
 * En vista de día una columna es una persona; en vista de semana, un día
 * de una sola persona. Mostrar la semana de todo el equipo a la vez daría
 * 21 columnas y ninguna se leería.
 */
const columns = computed(() => {
  const days = agenda.value?.days ?? []

  if (view.value === 'day') {
    const day = days[0]

    return (day?.resources ?? []).map((resource) => ({
      key: resource.id,
      label: resource.name,
      sublabel: `${resource.appointments.length}`,
      color: resource.color,
      resource,
      date: day.date,
    }))
  }

  const focused = focusedResourceId.value ?? staff.value[0]?.id ?? null

  return days
    .map((day) => {
      const resource = day.resources.find((r) => r.id === focused)
      if (!resource) {
        return null
      }

      const date = new Date(`${day.date}T12:00:00`)

      return {
        key: day.date,
        label: date.toLocaleDateString('es-CO', { weekday: 'short' }),
        sublabel: date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        color: resource.color,
        resource,
        date: day.date,
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
})

const totalAppointments = computed(() =>
  (agenda.value?.days ?? []).reduce(
    (sum, day) => sum + day.resources.reduce((s, r) => s + r.appointments.length, 0),
    0,
  ),
)

function shift(days: number): void {
  anchor.value = addDays(anchor.value, view.value === 'day' ? days : days * 7)
}

function today(): void {
  anchor.value = new Date().toISOString().slice(0, 10)
}

function onPick(payload: { date: string; resourceId: number; time: string }): void {
  const resource = staff.value.find((r) => r.id === payload.resourceId)

  pick.value = {
    date: payload.date,
    resourceId: payload.resourceId,
    resourceName: resource?.name ?? '',
    time: payload.time,
  }
}

/**
 * Agendar sin tocar la rejilla.
 *
 * Buscar el hueco a ojo entre columnas es tedioso, y en un teléfono es
 * directamente impracticable: la rejilla se desplaza a lo ancho y a lo alto y
 * el objetivo táctil es una franja de 15 minutos. El modal pide el día y
 * ofrece las horas que de verdad quedan.
 */
function openComposer(): void {
  pick.value = {
    date: anchor.value,
    resourceId: null,
    resourceName: null,
    time: null,
  }
}

async function onMove(payload: {
  id: number
  date: string
  resourceId: number
  time: string
}): Promise<void> {
  try {
    await reschedule({
      id: payload.id,
      starts_at: `${payload.date} ${payload.time}:00`,
      resource_id: payload.resourceId,
    })
    notify('Cita movida.', 'success')
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status

    // 409 es que el destino ya estaba ocupado. La rejilla se recarga sola,
    // así que basta con decirlo: no hay nada que deshacer a mano.
    notify(
      status === 409 ? 'Ese horario ya está ocupado.' : 'No pudimos mover la cita.',
      status === 409 ? 'warn' : 'error',
    )
  }
}

/*
 * Los avisos de "listo" van en funciones con nombre, no en el template.
 *
 * Un manejador con dos sentencias en línea funciona sólo mientras alguien lo
 * escriba con punto y coma: Prettier lo parte en dos líneas, los quita, y el
 * compilador de plantillas de Vue lo rechaza. Eso ya rompió esta pantalla
 * entera una vez, y el typecheck no lo ve porque no compila plantillas.
 */
function onBooked(): void {
  pick.value = null
  notify('Cita agendada.', 'success')
}

function onCharged(): void {
  toCheckout.value = null
  notify('Servicio cobrado. La comisión quedó registrada.', 'success')
}

function onCancelled(): void {
  toCheckout.value = null
  notify('Cita cancelada. El horario vuelve a estar libre.', 'success')
}

/** Abre el cobro de una cita tocada en la rejilla. */
function onOpen(appointment: GridAppointment): void {
  if (appointment.is_paid) {
    notify('Esta cita ya fue cobrada.', 'info')
    return
  }

  const full = dayAppointments.value?.find((a) => a.id === appointment.id)

  if (full && auth.can('caja.cobrar')) {
    toCheckout.value = full
  }
}
</script>

<template>
  <section class="flex h-full flex-col p-4 md:p-6">
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Agenda</h1>
        <p class="text-sm text-slate-500">
          {{ auth.business?.name }}
          <span v-if="agenda" class="text-slate-400">· {{ agenda.timezone }}</span>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Primero en el orden de lectura y visualmente destacado: agendar es
             lo que más se hace en esta pantalla. -->
        <NxButton v-if="canEdit" size="sm" @click="openComposer">
          <i class="pi pi-plus mr-1.5 text-xs" />Agendar cita
        </NxButton>

        <!-- Sólo con más de un local. Un selector de una sola opción es ruido
             en la barra más usada del producto. -->
        <select
          v-if="variasSedes"
          v-model.number="locationId"
          class="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
          aria-label="Sede"
        >
          <option v-for="sede in sedes" :key="sede.id" :value="sede.id">{{ sede.name }}</option>
        </select>

        <div class="flex overflow-hidden rounded-md border border-slate-200">
          <button
            v-for="option in ['day', 'week'] as View[]"
            :key="option"
            type="button"
            class="px-3 py-1.5 text-sm"
            :class="view === option ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'"
            @click="view = option"
          >
            {{ option === 'day' ? 'Día' : 'Semana' }}
          </button>
        </div>

        <NxButton variant="outline" size="sm" @click="shift(-1)">‹</NxButton>
        <NxButton variant="outline" size="sm" @click="today">Hoy</NxButton>
        <NxButton variant="outline" size="sm" @click="shift(1)">›</NxButton>

        <div class="w-40">
          <NxDatePicker v-model="anchor" />
        </div>
      </div>
    </header>

    <!-- En semana se mira a una persona a la vez: 7 días × 3 personas serían
         21 columnas y ninguna se leería. -->
    <div v-if="view === 'week' && staff.length > 1" class="mb-3 flex flex-wrap gap-2">
      <button
        v-for="person in staff"
        :key="person.id"
        type="button"
        class="rounded-full border px-3 py-1 text-sm"
        :class="
          (focusedResourceId ?? staff[0]?.id) === person.id
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
            : 'border-slate-200 bg-white text-slate-600'
        "
        @click="focusedResourceId = person.id"
      >
        {{ person.name }}
      </button>
    </div>

    <p class="mb-2 text-sm text-slate-500">
      <span v-if="isFetching">Cargando…</span>
      <span v-else>{{ totalAppointments }} cita(s)</span>
      <!-- El atajo de la rejilla se menciona sólo donde existe: en un teléfono
           no se arrastra nada y el texto sólo ocuparía sitio. -->
      <span v-if="canEdit" class="ml-2 hidden text-slate-400 md:inline">
        · Toca un espacio libre para agendar, arrastra una cita para moverla
      </span>
    </p>

    <div class="flex-1 rounded-lg border border-slate-200 bg-white">
      <p v-if="!columns.length" class="px-4 py-10 text-center text-sm text-slate-500">
        Todavía no hay nadie en el equipo. Agrega a alguien en Equipo.
      </p>

      <CalendarGrid
        v-else
        :columns="columns"
        :day-start="agenda?.day_start ?? '09:00'"
        :day-end="agenda?.day_end ?? '18:00'"
        :granularity="granularity"
        :can-edit="canEdit"
        @pick="onPick"
        @open="onOpen"
        @move="onMove"
      />
    </div>

    <!-- `location-id`: se agenda en el local que está en pantalla, no en
         cualquiera. El modal sólo ofrece a la gente de esa sede. -->
    <BookSlotModal
      :pick="pick"
      :services="services ?? []"
      :default-service-id="services?.[0]?.id ?? null"
      :location-id="locationId"
      @close="pick = null"
      @booked="onBooked"
    />

    <CheckoutModal
      :appointment="toCheckout"
      @close="toCheckout = null"
      @done="onCharged"
      @cancelled="onCancelled"
    />
  </section>
</template>
