<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxDatePicker, NxInput, NxModal, NxSelect } from '@/ui'

import { searchClients, useBookAppointment, type ClientOption } from '../composables/useAppointments'
import {
  useAvailability,
  useChainAvailability,
  usePackages,
  useResources,
  type ChainLeg,
  type ChainSlot,
  type Service,
} from '../composables/useAvailability'

/**
 * De dónde viene la petición de agendar.
 *
 * Con `time` y `resourceId` viene del calendario: alguien tocó un hueco
 * concreto. Con los dos en null viene del botón «Agendar cita», y entonces el
 * modal ofrece las horas él mismo -- y deja armar una visita de varios
 * servicios, que es algo que tocar una celda de la rejilla no puede expresar.
 */
export interface SlotPick {
  date: string
  resourceId: number | null
  resourceName: string | null
  /** HH:MM en hora del negocio. */
  time: string | null
}

const props = defineProps<{
  pick: SlotPick | null
  services: Service[]
  /** Servicio preseleccionado, normalmente el del filtro de la agenda. */
  defaultServiceId: number | null
}>()

const emit = defineEmits<{ close: []; booked: [] }>()

const open = computed(() => props.pick !== null)
/** Sin hora: el modal la pide. */
const picking = computed(() => props.pick !== null && props.pick.time === null)

type Mode = 'one' | 'many' | 'package'
const mode = ref<Mode>('one')

const serviceId = ref<number | null>(null)
const chainIds = ref<number[]>([])
const packageId = ref<number | null>(null)
const date = ref('')

/**
 * "Quiero todo con Aleja".
 *
 * Preferencia, no filtro: las horas en que Aleja no puede con algún servicio
 * se siguen ofreciendo, diciendo quién toma ese tramo.
 */
const preferredId = ref<number | null>(null)

/** Del calendario, o el elegido en la lista de horas. */
const chosenResourceId = ref<number | null>(null)
const chosenTime = ref<string | null>(null)
const chosenChain = ref<ChainSlot | null>(null)

const term = ref('')
const results = ref<ClientOption[]>([])
const selected = ref<ClientOption | null>(null)
const phone = ref('')
const notes = ref('')
const error = ref<string | null>(null)
const conflict = ref(false)

const { mutateAsync, isPending } = useBookAppointment()
const { data: availability, isFetching: loadingSlots } = useAvailability(serviceId, date)
const { data: chain, isFetching: loadingChain } = useChainAvailability(
  chainIds,
  packageId,
  date,
  preferredId,
)
const { data: packagesData } = usePackages()

const service = computed(() => props.services.find((s) => s.id === serviceId.value) ?? null)
const packages = computed(() => (packagesData.value?.packages ?? []).filter((p) => p.is_active))

/**
 * Qué servicios se pueden elegir.
 *
 * Desde el calendario, sólo los que esa persona presta: ofrecer el resto lleva
 * a un hueco que no existe. Desde el botón, todos -- la persona se elige
 * después, con las horas que de verdad quedan.
 */
const available = computed(() =>
  props.pick?.resourceId
    ? props.services.filter((s) => s.resource_ids?.includes(props.pick!.resourceId!) ?? true)
    : props.services,
)

const slots = computed(() => availability.value?.slots ?? [])
const chainSlots = computed(() => chain.value?.slots ?? [])

const { data: resourcesData } = useResources()
const staff = computed(() => (resourcesData.value ?? []).filter((r) => r.type === 'staff'))

/** Por qué este tramo quedó con otra persona, dicho como se diría en el mostrador. */
function legNote(leg: ChainLeg): string | null {
  if (leg.changed_reason === null) {
    return null
  }

  const quien = chain.value?.preferred_resource?.name

  if (leg.changed_reason === 'skill') {
    return quien
      ? `${quien} no presta ${leg.service_name.toLowerCase()}`
      : `Lo toma otra persona: no todas prestan ${leg.service_name.toLowerCase()}`
  }

  return quien ? `${quien} no está libre a esa hora` : 'Lo toma otra persona por disponibilidad'
}

function money(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(term, (value) => {
  selected.value = null
  clearTimeout(timer)
  timer = setTimeout(async () => {
    results.value = await searchClients(value)
  }, 250)
})

watch(open, (isOpen) => {
  if (!isOpen) {
    return
  }

  mode.value = 'one'
  // Si esa persona no presta el servicio del filtro, se elige el primero
  // que sí presta en vez de dejar el campo en algo imposible.
  const preferred = available.value.find((s) => s.id === props.defaultServiceId)
  serviceId.value = preferred?.id ?? available.value[0]?.id ?? null

  chainIds.value = []
  packageId.value = null
  date.value = props.pick?.date ?? ''
  // Si vino de tocar la columna de alguien, esa es la persona que se quiere.
  preferredId.value = props.pick?.resourceId ?? null
  chosenResourceId.value = props.pick?.resourceId ?? null
  chosenTime.value = props.pick?.time ?? null
  chosenChain.value = null

  term.value = ''
  results.value = []
  selected.value = null
  phone.value = ''
  notes.value = ''
  error.value = null
  conflict.value = false
})

// Cambiar lo que se va a hacer, o el día, invalida la hora elegida: ese hueco
// era de otra combinación y puede no existir para la nueva.
watch([serviceId, date, chainIds, packageId, mode, preferredId], () => {
  if (picking.value) {
    chosenTime.value = null
    chosenResourceId.value = null
    chosenChain.value = null
  }
})

function toggleChainService(id: number): void {
  chainIds.value = chainIds.value.includes(id)
    ? chainIds.value.filter((s) => s !== id)
    : [...chainIds.value, id]
}

function pickSlot(slot: { starts_at: string; resource_id: number }): void {
  chosenResourceId.value = slot.resource_id
  // De la marca ISO a HH:MM en hora del negocio, que es lo que la API espera
  // cuando la cadena no lleva desfase.
  chosenTime.value = new Date(slot.starts_at).toTimeString().slice(0, 5)
}

function pickChain(slot: ChainSlot): void {
  chosenChain.value = slot
  chosenTime.value = slot.label
}

function choose(client: ClientOption): void {
  selected.value = client
  term.value = client.full_name
  results.value = []
}

/** Con quién queda, para poder decirlo antes de confirmar. */
const chosenResourceName = computed(() => {
  if (props.pick?.resourceName) return props.pick.resourceName
  return slots.value.find((s) => s.resource_id === chosenResourceId.value)?.resource_name ?? null
})

const isChain = computed(() => mode.value !== 'one' && picking.value)

const canSubmit = computed(() => {
  if (term.value.trim().length < 2 || isPending.value) return false

  return isChain.value
    ? chosenChain.value !== null
    : serviceId.value !== null && chosenTime.value !== null && chosenResourceId.value !== null
})

async function submit(): Promise<void> {
  error.value = null
  conflict.value = false

  const client = {
    client_id: selected.value?.id ?? null,
    client_name: selected.value?.full_name ?? term.value.trim(),
    client_phone: selected.value ? undefined : phone.value.trim() || undefined,
    notes: notes.value.trim() || undefined,
  }

  try {
    if (isChain.value && chosenChain.value) {
      await mutateAsync({
        // Cada tramo lleva SU hora y SU persona: la cadena la calculó el
        // motor, con buffers y cambios de persona ya resueltos. Recalcularla
        // acá sería hacer dos veces la misma cuenta.
        items: chosenChain.value.legs.map((leg) => ({
          service_id: leg.service_id,
          resource_id: leg.resource_id,
          starts_at: leg.starts_at,
        })),
        service_package_id: packageId.value,
        ...client,
      })
    } else {
      await mutateAsync({
        service_id: serviceId.value!,
        resource_id: chosenResourceId.value!,
        // El backend interpreta esta hora en la zona del negocio.
        starts_at: `${date.value} ${chosenTime.value}:00`,
        ...client,
      })
    }

    emit('booked')
  } catch (e) {
    if ((e as { response?: { status?: number } }).response?.status === 409) {
      conflict.value = true
      return
    }

    error.value = extractErrorMessage(e, 'No pudimos agendar la cita.')
  }
}
</script>

<template>
  <NxModal :model-value="open" title="Agendar cita" @update:model-value="emit('close')">
    <div v-if="pick" class="flex flex-col gap-4">
      <!-- Qué se va a hacer. Sólo desde el botón: tocar una celda de la
           rejilla ya dijo persona y hora, y ahí una cadena no cabe. -->
      <div v-if="picking" class="flex gap-2">
        <button
          v-for="option in ([
            { value: 'one', label: 'Un servicio' },
            { value: 'many', label: 'Varios' },
            { value: 'package', label: 'Combo' },
          ] as Array<{ value: Mode; label: string }>)"
          :key="option.value"
          type="button"
          class="flex-1 rounded-md border px-3 py-1.5 text-sm transition"
          :class="
            mode === option.value
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-slate-200 bg-white text-slate-600'
          "
          :disabled="isPending"
          @click="mode = option.value"
        >
          {{ option.label }}
        </button>
      </div>

      <!-- Resumen de lo elegido -->
      <div v-if="chosenTime" class="rounded-md bg-slate-50 px-4 py-3 text-sm">
        <p class="font-medium text-slate-800">
          {{ chosenTime }}<span v-if="chosenResourceName"> con {{ chosenResourceName }}</span>
        </p>
        <p v-if="!isChain && service" class="text-slate-600">
          {{ service.name }} · {{ service.duration_min }} min
          <span v-if="service.occupied_min !== service.duration_min" class="text-slate-400">
            (ocupa {{ service.occupied_min }})
          </span>
        </p>
        <p v-for="leg in chosenChain?.legs ?? []" :key="leg.service_id" class="text-slate-600">
          {{ leg.label }} · {{ leg.service_name }} con {{ leg.resource_name }}
          <!-- El motivo del cambio se dice acá, no se deja adivinar: "no lo
               presta" y "no está libre" llevan a decisiones distintas. -->
          <span v-if="legNote(leg)" class="text-xs text-amber-700">— {{ legNote(leg) }}</span>
        </p>
        <p
          v-if="chosenChain && chosenChain.legs.length > 1 && chosenChain.same_person"
          class="text-xs text-emerald-700"
        >
          Toda la visita con {{ chosenChain.legs[0].resource_name }}.
        </p>
      </div>

      <div v-if="conflict" class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Ese horario acaba de ser tomado. Elige otro.
      </div>

      <template v-else>
        <!-- Un servicio -->
        <template v-if="!isChain">
          <p v-if="!available.length" class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {{ pick.resourceName ?? 'Esta persona' }} no tiene servicios asignados todavía.
          </p>

          <NxSelect
            v-else
            v-model="serviceId"
            :options="available"
            option-label="name"
            option-value="id"
            label="Servicio"
            :disabled="isPending"
          />
        </template>

        <!-- Varios servicios -->
        <div v-else-if="mode === 'many'">
          <p class="mb-1.5 text-sm text-slate-600">
            Qué se va a hacer
            <span class="text-xs text-slate-400">· en el orden que los marques</span>
          </p>

          <div class="max-h-40 divide-y divide-slate-50 overflow-y-auto rounded-md border border-slate-200">
            <label
              v-for="item in services"
              :key="item.id"
              class="flex items-center gap-2.5 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                :checked="chainIds.includes(item.id)"
                :disabled="isPending"
                @change="toggleChainService(item.id)"
              />
              <span class="min-w-0 flex-1 truncate text-slate-700">{{ item.name }}</span>
              <span
                v-if="chainIds.includes(item.id)"
                class="shrink-0 rounded bg-slate-100 px-1.5 text-xs text-slate-500"
              >
                {{ chainIds.indexOf(item.id) + 1 }}
              </span>
              <span class="shrink-0 text-xs text-slate-400">{{ item.duration_min }} min</span>
            </label>
          </div>

          <p v-if="chain" class="mt-1.5 text-xs text-slate-500">
            {{ chain.total_minutes }} min en total
          </p>
        </div>

        <!-- Combo -->
        <div v-else>
          <p v-if="!packages.length" class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Todavía no hay combos. Créalos en Servicios.
          </p>

          <div v-else class="divide-y divide-slate-50 rounded-md border border-slate-200">
            <button
              v-for="pack in packages"
              :key="pack.id"
              type="button"
              class="flex w-full items-start gap-3 px-3 py-2.5 text-left transition"
              :class="packageId === pack.id ? 'bg-indigo-50' : 'hover:bg-slate-50'"
              :disabled="isPending"
              @click="packageId = pack.id"
            >
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-slate-800">{{ pack.name }}</span>
                <span class="block truncate text-xs text-slate-500">
                  {{ pack.services.map((s) => s.name).join(' + ') }}
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="block text-sm text-slate-800">{{ money(pack.total) }}</span>
                <span v-if="pack.discount > 0" class="block text-xs text-emerald-700">
                  −{{ money(pack.discount) }}
                </span>
              </span>
            </button>
          </div>
        </div>

        <!-- Con quién.
             Sólo en visitas de varios servicios: con uno solo, la persona sale
             en cada hora de la lista y elegirla dos veces sobra. -->
        <div v-if="picking && isChain && staff.length > 1">
          <p class="mb-1.5 text-sm text-slate-600">
            Con quién
            <span class="text-xs text-slate-400">· se respeta en lo que pueda hacer</span>
          </p>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-md border px-2.5 py-1.5 text-sm transition"
              :class="
                preferredId === null
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-700 hover:border-slate-400'
              "
              :disabled="isPending"
              @click="preferredId = null"
            >
              Cualquiera
            </button>

            <button
              v-for="person in staff"
              :key="person.id"
              type="button"
              class="rounded-md border px-2.5 py-1.5 text-sm transition"
              :class="
                preferredId === person.id
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-700 hover:border-slate-400'
              "
              :disabled="isPending"
              @click="preferredId = person.id"
            >
              {{ person.name }}
            </button>
          </div>
        </div>

        <!-- Día y hora -->
        <template v-if="picking">
          <NxDatePicker v-model="date" label="Día" :disabled="isPending" />

          <div>
            <p class="mb-1.5 text-sm text-slate-600">Hora</p>

            <p v-if="loadingSlots || loadingChain" class="text-sm text-slate-500">
              Buscando horas libres…
            </p>

            <!-- Cadena -->
            <template v-else-if="isChain">
              <!-- Antes de elegir qué se va a hacer no hay nada que buscar:
                   decir "no cabe" ahí acusa de imposible algo que nadie pidió
                   todavía. -->
              <p
                v-if="!chainIds.length && !packageId"
                class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500"
              >
                {{ mode === 'package' ? 'Elige un combo para ver las horas.' : 'Marca los servicios para ver las horas.' }}
              </p>

              <p
                v-else-if="!chainSlots.length"
                class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500"
              >
                No cabe esa combinación ese día. Prueba con otro día o con menos servicios.
              </p>

              <div v-else class="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                <button
                  v-for="(slot, i) in chainSlots"
                  :key="i"
                  type="button"
                  class="rounded-md border px-2.5 py-1.5 text-sm transition"
                  :class="
                    chosenChain?.starts_at === slot.starts_at
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-700 hover:border-slate-400'
                  "
                  :disabled="isPending"
                  @click="pickChain(slot)"
                >
                  {{ slot.label }}
                  <!-- La hora en que todo queda con la misma persona no se ve
                       igual que una en que hay que cambiar de silla. Se marca
                       antes de elegirla, no después. -->
                  <span
                    v-if="preferredId ? slot.preferred_honored : slot.same_person"
                    class="ml-1 text-xs text-emerald-600"
                    title="Toda la visita con la misma persona"
                  >
                    ✓
                  </span>
                  <span v-else class="ml-1 text-xs text-amber-600" title="Se reparte entre dos">
                    ⇄
                  </span>
                </button>
              </div>
            </template>

            <!-- Un servicio -->
            <template v-else>
              <p
                v-if="!slots.length"
                class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500"
              >
                No quedan horas ese día para este servicio. Prueba con otro día.
              </p>

              <div v-else class="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                <button
                  v-for="(slot, i) in slots"
                  :key="i"
                  type="button"
                  class="rounded-md border px-2.5 py-1.5 text-sm transition"
                  :class="
                    chosenTime && chosenResourceId === slot.resource_id &&
                    slot.starts_at.includes(chosenTime)
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-700 hover:border-slate-400'
                  "
                  :disabled="isPending"
                  @click="pickSlot(slot)"
                >
                  {{ slot.label }}
                  <span class="ml-1 text-xs text-slate-400">{{ slot.resource_name }}</span>
                </button>
              </div>
            </template>
          </div>
        </template>

        <div class="relative">
          <NxInput v-model="term" label="Cliente" :disabled="isPending" autocomplete="off" />

          <ul
            v-if="results.length"
            class="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
          >
            <li v-for="client in results" :key="client.id">
              <button
                type="button"
                class="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                @click="choose(client)"
              >
                {{ client.label }}
              </button>
            </li>
          </ul>

          <p v-if="selected" class="mt-1 text-xs text-emerald-700">
            Cliente existente · {{ selected.phone ?? 'sin teléfono' }}
          </p>
          <p v-else-if="term.trim().length > 1" class="mt-1 text-xs text-slate-500">
            Se guardará como cliente nuevo.
          </p>
        </div>

        <NxInput
          v-if="!selected"
          v-model="phone"
          label="Teléfono (opcional)"
          inputmode="tel"
          :disabled="isPending"
        />

        <NxInput v-model="notes" label="Nota (opcional)" :disabled="isPending" />

        <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>
      </template>

      <div class="flex justify-end gap-2">
        <NxButton variant="secondary" :disabled="isPending" @click="emit('close')">
          {{ conflict ? 'Cerrar' : 'Cancelar' }}
        </NxButton>
        <NxButton v-if="!conflict" :loading="isPending" :disabled="!canSubmit" @click="submit">
          Agendar
        </NxButton>
      </div>
    </div>
  </NxModal>
</template>
