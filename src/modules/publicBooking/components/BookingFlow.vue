<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'

import MonthCalendar from './MonthCalendar.vue'
import {
  useCreatePublicBooking,
  usePublicChain,
  usePublicDays,
  usePublicSlots,
  type BookingResult,
  type PublicChainLeg,
  type PublicChainSlot,
  type PublicPackage,
  type PublicPage,
  type PublicResource,
  type PublicService,
} from '../composables/usePublicBooking'

const props = defineProps<{
  slug: string
  page: PublicPage
  preselected: number | null
  preselectedPackage: number | null
}>()

const slug = computed(() => props.slug)

/*
|------------------------------------------------------------------------------
| Reservar desde el navegador de WhatsApp
|------------------------------------------------------------------------------
| La mayoría de estas reservas entran por un enlace pegado en un chat, y ese
| navegador embebido es el peor caso: pantalla corta, barra del sistema que
| tapa el borde de abajo, y nada de teclado físico. De ahí salen decisiones que
| en un escritorio parecerían exageradas:
|
|   - Un paso por pantalla, con lo elegido siempre a la vista arriba.
|   - Todo lo tocable mide 44px de alto. El pulgar no acierta menos.
|   - Los campos van en 16px: por debajo de eso, iOS hace zoom al enfocar y
|     deja la página corrida sin forma de volver.
|   - Nada depende de `hover`: en un teléfono no existe.
|   - Ningún botón pegado al borde inferior de la ventana, que es justo donde
|     WhatsApp pone su barra.
*/
const step = ref<1 | 2 | 3 | 4>(1)
const root = ref<HTMLElement | null>(null)

const serviceId = ref<number | null>(null)
/** Un combo elegido en el paso 1. Excluyente con `serviceId`. */
const packageId = ref<number | null>(null)
/**
 * Varios servicios sueltos, en el orden en que se marcaron.
 *
 * No es un combo: se cobran a precio de lista. Es el caso de quien va a
 * hacerse manos y pies el mismo día sin que el negocio los venda juntos.
 */
const chainIds = ref<number[]>([])
/** El paso 1 está armando una visita de varias cosas. */
const armando = ref(false)
const resourceId = ref<number | null>(null)
const date = ref<string | null>(null)
const startsAt = ref<string | null>(null)
const chosenResourceId = ref<number | null>(null)
/** La cadena elegida: cada servicio con su persona y su hora. */
const chosenChain = ref<PublicChainSlot | null>(null)

const name = ref('')
const phone = ref('')
const email = ref('')
const notes = ref('')
const error = ref<string | null>(null)
const done = ref<BookingResult | null>(null)

const today = new Date().toLocaleDateString('sv-SE')
/** Desde dónde se piden los días de las fichas rápidas. */
const from = ref(today)
/** El mes que está mirando el calendario, como su día 1. */
const monthFrom = ref(today)
const MES_COMPLETO = ref(42)

const packages = computed<PublicPackage[]>(() => props.page.packages ?? [])

const pack = computed<PublicPackage | null>(
  () => packages.value.find((p) => p.id === packageId.value) ?? null,
)

/*
 * Para una visita de varias partes, los días se consultan con su PRIMER
 * servicio. Es un filtro necesario pero no suficiente: un día sin hueco para
 * el primero tampoco lo tiene para la cadena, así que se puede apagar sin
 * equivocarse. Al revés no vale, y por eso el día que queda encendido lo
 * confirma la cadena. Calcular la cadena completa de un mes para pintar el
 * calendario sería caro y nadie miraría la diferencia.
 */
const daysServiceId = computed(
  () => serviceId.value ?? pack.value?.services[0]?.id ?? chainIds.value[0] ?? null,
)

const { data: daysData, isFetching: loadingDays } = usePublicDays(
  slug,
  daysServiceId,
  from,
  resourceId,
)
const { data: monthData, isFetching: loadingMonth } = usePublicDays(
  slug,
  daysServiceId,
  monthFrom,
  resourceId,
  MES_COMPLETO,
)
const { data: slotsData, isFetching: loadingSlots } = usePublicSlots(slug, serviceId, date, resourceId)
const { data: chainData, isFetching: loadingChain } = usePublicChain(
  slug,
  packageId,
  date,
  resourceId,
  chainIds,
)
const { mutateAsync: book, isPending: booking } = useCreatePublicBooking(slug)

const service = computed<PublicService | null>(
  () => props.page.services.find((s) => s.id === serviceId.value) ?? null,
)

/** Los servicios sueltos elegidos, en el orden en que se marcaron. */
const chainServices = computed<PublicService[]>(() =>
  chainIds.value
    .map((id) => props.page.services.find((s) => s.id === id))
    .filter((s): s is PublicService => s !== undefined),
)

const chainTotal = computed(() => chainServices.value.reduce((sum, s) => sum + s.price, 0))
const chainMinutes = computed(() => chainServices.value.reduce((sum, s) => sum + s.duration_min, 0))

/** La visita tiene varias partes: combo o servicios sueltos encadenados. */
const isChain = computed(() => pack.value !== null || chainIds.value.length > 0)

const whatLabel = computed(() => {
  if (pack.value) return pack.value.name
  if (service.value) return service.value.name
  if (chainServices.value.length) return chainServices.value.map((s) => s.name).join(' + ')

  return null
})

const totalLabel = computed(() => {
  if (pack.value) return money(pack.value.total)
  if (service.value) return money(service.value.price)
  if (chainServices.value.length) return money(chainTotal.value)

  return null
})

const minutesLabel = computed(() => {
  if (pack.value) return pack.value.total_minutes
  if (service.value) return service.value.duration_min
  if (chainServices.value.length) return chainMinutes.value

  return null
})

/**
 * Quién se puede pedir.
 *
 * Para un servicio suelto, sólo quien lo presta: ofrecer al resto lleva a un
 * hueco vacío. Para una visita de varias partes, quien preste AL MENOS UNA --
 * pedirla es una preferencia, y el servidor dice qué parte tuvo que tomar otra
 * persona en vez de esconder la hora entera.
 */
const resources = computed<PublicResource[]>(() => {
  const varios = pack.value ? pack.value.services.map((s) => s.id) : chainIds.value

  if (varios.length) {
    return props.page.resources.filter((r) =>
      props.page.services.some((s) => varios.includes(s.id) && s.resource_ids.includes(r.id)),
    )
  }

  return props.page.resources.filter((r) => service.value?.resource_ids.includes(r.id) ?? false)
})

const chosenResource = computed(
  () => resources.value.find((r) => r.id === resourceId.value) ?? null,
)

/** Por qué esa parte quedó con otra persona, dicho como en el mostrador. */
function legNote(leg: PublicChainLeg): string | null {
  if (leg.changed_reason === null) {
    return null
  }

  const quien = chosenResource.value?.name

  if (leg.changed_reason === 'skill') {
    return quien ? `${quien} no hace este servicio` : 'Lo toma otra persona'
  }

  return quien ? `${quien} no está libre a esa hora` : 'Lo toma otra persona por disponibilidad'
}

/*
|------------------------------------------------------------------------------
| Días y horas
|------------------------------------------------------------------------------
*/

/** `YYYY-MM-DD` → si ese día tiene algo libre, para apagar el calendario. */
const monthAvailability = computed<Record<string, boolean>>(() => {
  const result: Record<string, boolean> = {}

  for (const d of [...(daysData.value?.days ?? []), ...(monthData.value?.days ?? [])]) {
    result[d.date] = d.has_slots
  }

  return result
})

/** Los primeros días con cupo, para tocar uno sin abrir el calendario. */
const quickDays = computed(() =>
  (daysData.value?.days ?? []).filter((d) => d.has_slots).slice(0, 6),
)

function dayChip(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  const manana = new Date(`${today}T12:00:00`)
  manana.setDate(manana.getDate() + 1)

  if (isoDate === today) return 'Hoy'
  if (isoDate === manana.toLocaleDateString('sv-SE')) return 'Mañana'

  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' })
}

function dayLabel(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * En qué franja cae una hora, leyendo la ETIQUETA y no la fecha.
 *
 * La etiqueta viene en hora del negocio. Si se agrupara con `new Date()` se
 * usaría la zona del teléfono, y quien reserve desde otro país vería su
 * manicure de las 9 am agrupada en "Tarde".
 */
function franja(label: string): 'manana' | 'tarde' | 'noche' {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(label.trim())

  if (!match) {
    return 'manana'
  }

  let hour = Number(match[1]) % 12
  if (match[3].toLowerCase() === 'pm') hour += 12

  if (hour < 12) return 'manana'

  return hour < 18 ? 'tarde' : 'noche'
}

const FRANJAS = [
  { key: 'manana', label: 'Mañana' },
  { key: 'tarde', label: 'Tarde' },
  { key: 'noche', label: 'Noche' },
] as const

/** Las horas de la cadena agrupadas por franja, sin franjas vacías. */
const chainByFranja = computed(() =>
  FRANJAS.map((f) => ({
    ...f,
    slots: (chainData.value?.slots ?? []).filter((s) => franja(s.label) === f.key),
  })).filter((f) => f.slots.length > 0),
)

const slotsByFranja = computed(() =>
  FRANJAS.map((f) => ({
    ...f,
    slots: (slotsData.value?.slots ?? []).filter((s) => franja(s.label) === f.key),
  })).filter((f) => f.slots.length > 0),
)

const loadingHoras = computed(() => loadingSlots.value || loadingChain.value)

/*
|------------------------------------------------------------------------------
| Navegación
|------------------------------------------------------------------------------
*/

watch(
  () => props.preselected,
  (id) => {
    if (id !== null) pickService(id)
  },
  { immediate: true },
)

watch(
  () => props.preselectedPackage,
  (id) => {
    if (id !== null) pickPackage(id)
  },
  { immediate: true },
)

/*
 * Cambiar de paso sube la vista al principio del bloque.
 *
 * En una pantalla corta, tocar un servicio que estaba abajo deja el paso
 * siguiente fuera de cuadro: se ve la misma lista y parece que el toque no
 * hizo nada.
 */
watch(step, async () => {
  await nextTick()
  root.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

function money(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: props.page.business.currency ?? 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function resetChoice(): void {
  resourceId.value = null
  date.value = null
  startsAt.value = null
  chosenChain.value = null
}

function pickService(id: number): void {
  serviceId.value = id
  packageId.value = null
  chainIds.value = []
  resetChoice()
  step.value = 2
}

function pickPackage(id: number): void {
  packageId.value = id
  serviceId.value = null
  chainIds.value = []
  resetChoice()
  step.value = 2
}

/** Marcar y desmarcar en el paso 1. El ORDEN es el de la visita. */
function toggleChainService(id: number): void {
  chainIds.value = chainIds.value.includes(id)
    ? chainIds.value.filter((x) => x !== id)
    : [...chainIds.value, id]
}

function confirmChainServices(): void {
  if (!chainIds.value.length) return

  serviceId.value = null
  packageId.value = null
  resetChoice()
  step.value = 2
}

function pickResource(id: number | null): void {
  resourceId.value = id
  date.value = null
  startsAt.value = null
  chosenChain.value = null
  step.value = 3
}

function pickDay(value: string): void {
  date.value = value
  startsAt.value = null
  chosenChain.value = null
}

function pickSlot(slot: { starts_at: string; resource_id: number }): void {
  startsAt.value = slot.starts_at
  // Con "cualquiera", el hueco elegido decide quién atiende.
  chosenResourceId.value = slot.resource_id
  step.value = 4
}

function pickChain(slot: PublicChainSlot): void {
  chosenChain.value = slot
  startsAt.value = slot.starts_at
  step.value = 4
}

function back(): void {
  error.value = null
  if (step.value > 1) step.value = (step.value - 1) as 1 | 2 | 3

  // Volviendo al paso 1 con una visita ya armada, se vuelve a ver armada: si
  // no, el primer servicio que se toque borraría los otros sin avisar.
  if (step.value === 1 && chainIds.value.length) {
    armando.value = true
  }
}

/*
|------------------------------------------------------------------------------
| Datos y envío
|------------------------------------------------------------------------------
*/

const emailValido = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()))
const telefonoValido = computed(() => phone.value.replace(/\D/g, '').length >= 7)
const nombreValido = computed(() => name.value.trim().length > 2)

const canSubmit = computed(
  () => nombreValido.value && telefonoValido.value && emailValido.value && !booking.value,
)

async function submit(): Promise<void> {
  if (!startsAt.value) return
  if (!serviceId.value && !chosenChain.value) return
  error.value = null

  const cita = chosenChain.value
    ? {
        // Se manda la cadena tal como la calculó el servidor, con la persona
        // y la hora de cada parte. El servidor la revalida entera igual.
        service_package_id: packageId.value,
        items: chosenChain.value.legs.map((leg) => ({
          service_id: leg.service_id,
          resource_id: leg.resource_id,
          starts_at: leg.starts_at,
        })),
      }
    : {
        service_id: serviceId.value!,
        resource_id: chosenResourceId.value ?? resourceId.value!,
        starts_at: startsAt.value,
      }

  try {
    done.value = await book({
      ...cita,
      client_name: name.value.trim(),
      client_phone: phone.value.trim(),
      client_email: email.value.trim(),
      notes: notes.value.trim() || null,
    })
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos reservar. Intenta de nuevo.')
    // El hueco se ocupó mientras llenaba sus datos: volver a las horas es lo
    // único que sirve, y decirlo ahí es mejor que dejarla releyendo el error.
    if ((e as { response?: { status?: number } })?.response?.status === 409) {
      startsAt.value = null
      chosenChain.value = null
      step.value = 3
    }
  }
}

function restart(): void {
  done.value = null
  step.value = 1
  serviceId.value = null
  packageId.value = null
  chainIds.value = []
  armando.value = false
  resetChoice()
  name.value = ''
  phone.value = ''
  email.value = ''
  notes.value = ''
}

const TITULOS = ['¿Qué te vas a hacer?', '¿Con quién?', '¿Cuándo?', 'Tus datos']

/*
|------------------------------------------------------------------------------
| Abono
|------------------------------------------------------------------------------
| Algunos negocios piden un adelanto para separar. Es fricción, así que se dice
| ANTES de llenar el formulario y no después de confirmar: enterarse de que hay
| que pagar cuando ya diste tus datos es la peor forma de pedirlo.
*/

const deposit = computed(() => props.page.deposit)

/** Lo que le van a pedir de abono, calculado sobre lo que eligió. */
const depositAmount = computed(() => {
  const policy = deposit.value
  const total = pack.value ? pack.value.total : (service.value?.price ?? chainTotal.value)

  if (!policy || !total) {
    return 0
  }

  const bruto = policy.type === 'percent' ? total * (policy.value / 100) : policy.value

  // El mismo tope que aplica el servidor: cobrar por adelantado más de lo que
  // vale el servicio es un error de configuración, no un abono.
  return Math.round(Math.min(bruto, total))
})
</script>

<template>
  <!-- Confirmación -->
  <div
    v-if="done"
    class="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center"
  >
    <p
      class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white"
    >
      ✓
    </p>
    <h3 class="mt-3 text-lg font-semibold text-emerald-900">{{ done.message }}</h3>

    <p v-if="done.items.length < 2" class="mt-3 text-emerald-900">
      <b>{{ done.service }}</b> con {{ done.resource }}<br />
      {{ done.date_label }} a las {{ done.time_label }}
    </p>

    <!-- Visita de varias partes: se detalla parte por parte. Enterarse al
         llegar de que la segunda mitad la atiende otra persona es lo que hay
         que evitar. -->
    <div v-else class="mt-3 text-emerald-900">
      <p v-if="done.package" class="font-semibold">{{ done.package }}</p>
      <p>{{ done.date_label }}</p>
      <p v-for="(item, i) in done.items" :key="i" class="mt-1 text-sm">
        {{ item.time_label }} · {{ item.service }} con {{ item.resource }}
      </p>
    </div>

    <!-- El abono, con las instrucciones de pago. Va acá y no en un WhatsApp
         posterior: si no se dice ahora, la persona se va creyendo que la cita
         ya está asegurada. -->
    <div
      v-if="done.deposit_amount"
      class="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-900"
    >
      <p class="font-semibold">Falta el abono: {{ money(done.deposit_amount) }}</p>
      <p v-if="done.deposit_instructions" class="mt-1">{{ done.deposit_instructions }}</p>
      <p class="mt-1 text-xs">
        Tu cita queda apartada cuando lo recibamos. Se descuenta de lo que pagues ese día.
      </p>
    </div>

    <p class="mt-4 text-sm text-emerald-800">
      Te llegará la confirmación por WhatsApp. Si necesitas cambiarla o cancelarla, escríbenos.
      <!-- Cancelar no se puede desde acá a propósito: una URL pública que
           cancela citas es una URL pública que cancela las de otra persona. -->
    </p>
    <button
      type="button"
      class="mt-4 min-h-11 text-sm font-medium text-emerald-900 underline"
      @click="restart"
    >
      Reservar otra cita
    </button>
  </div>

  <div v-else ref="root" class="scroll-mt-4 [touch-action:manipulation]">
    <!-- Cabecera del paso: dónde voy, qué llevo elegido y cómo devolverme.
         En una pantalla corta esto es lo único que orienta. -->
    <div class="mb-4">
      <div class="flex items-center gap-3">
        <button
          v-if="step > 1"
          type="button"
          class="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-slate-500"
          aria-label="Atrás"
          @click="back"
        >
          ‹
        </button>

        <div class="min-w-0 flex-1">
          <p class="text-base font-semibold text-slate-900">{{ TITULOS[step - 1] }}</p>
          <p v-if="whatLabel" class="truncate text-xs text-slate-500">
            {{ whatLabel }}
            <span v-if="totalLabel">&nbsp;· {{ totalLabel }}</span>
            <span v-if="minutesLabel">&nbsp;· {{ minutesLabel }} min</span>
            <span v-if="chosenResource">&nbsp;· con {{ chosenResource.name }}</span>
            <span v-else-if="step > 2">&nbsp;· con quien esté disponible</span>
          </p>
        </div>
      </div>

      <!-- Barra de progreso en vez de "paso 3 de 4": se lee de un vistazo y no
           roba una línea de alto. -->
      <div class="mt-3 flex gap-1">
        <span
          v-for="i in 4"
          :key="i"
          class="h-1 flex-1 rounded-full transition"
          :class="i <= step ? 'bg-slate-900' : 'bg-slate-200'"
        />
      </div>
    </div>

    <!-- 1. Qué se va a hacer -->
    <div v-if="step === 1" class="flex flex-col gap-3">
      <!-- Los combos van primero y marcados: es lo que el negocio quiere
           vender, y lo que le sale más barato a quien reserva. -->
      <template v-if="packages.length">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Combos</p>

        <button
          v-for="combo in packages"
          :key="`p${combo.id}`"
          type="button"
          class="flex min-h-11 items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50/60 p-3 text-left active:bg-emerald-100"
          @click="pickPackage(combo.id)"
        >
          <img
            v-if="combo.image_url"
            :src="combo.image_url"
            :alt="combo.name"
            class="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span class="font-medium text-slate-900">{{ combo.name }}</span>
              <span
                v-if="combo.discount > 0"
                class="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white"
              >
                -{{ Math.round(combo.savings_percent) }}%
              </span>
            </span>
            <span class="mt-0.5 block truncate text-xs text-slate-500">
              {{ combo.services.map((s) => s.name).join(' + ') }}
            </span>
            <span class="mt-1 block text-sm text-slate-700">
              <b>{{ money(combo.total) }}</b>
              <span v-if="combo.discount > 0" class="ml-1 text-slate-400 line-through">
                {{ money(combo.list_total) }}
              </span>
              · {{ combo.total_minutes }} min
            </span>
          </span>
          <span class="shrink-0 text-slate-300">›</span>
        </button>

        <p class="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Servicios</p>
      </template>

      <!-- Armar una visita de varias cosas.
           No se pone de entrada: tocar un servicio y seguir es el camino del
           90% de la gente, y meterle un paso de "marca y confirma" a ese caso
           lo empeora para todos. -->
      <button
        v-if="page.services.length > 1"
        type="button"
        class="min-h-11 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-left text-sm text-slate-600 active:bg-slate-50"
        @click="armando = !armando"
      >
        {{ armando ? '← Prefiero un solo servicio' : '＋ ¿Te vas a hacer varias cosas? Arma tu visita' }}
      </button>

      <button
        v-for="item in page.services"
        :key="item.id"
        type="button"
        class="flex min-h-11 items-center gap-3 rounded-xl border bg-white p-3 text-left transition active:bg-slate-50"
        :class="
          armando && chainIds.includes(item.id)
            ? 'border-slate-900 ring-1 ring-slate-900'
            : 'border-slate-200'
        "
        @click="armando ? toggleChainService(item.id) : pickService(item.id)"
      >
        <img
          v-if="item.image_url"
          :src="item.image_url"
          :alt="item.name"
          class="h-16 w-16 shrink-0 rounded-lg object-cover"
        />

        <!-- Marcando: la casilla lleva el número de orden de la visita. Sin
             él, "manos y pies" y "pies y manos" se verían igual. -->
        <span
          v-if="armando"
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
          :class="
            chainIds.includes(item.id)
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-300 text-transparent'
          "
        >
          {{ chainIds.indexOf(item.id) + 1 }}
        </span>

        <span class="min-w-0 flex-1">
          <span class="block font-medium text-slate-900">{{ item.name }}</span>
          <span v-if="item.description" class="mt-0.5 block line-clamp-2 text-xs text-slate-500">
            {{ item.description }}
          </span>
          <span class="mt-1 block text-sm text-slate-700">
            {{ money(item.price) }} · {{ item.duration_min }} min
          </span>
        </span>

        <span v-if="!armando" class="shrink-0 text-slate-300">›</span>
      </button>

      <button
        v-if="armando && chainIds.length"
        type="button"
        class="min-h-12 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white active:bg-slate-700"
        @click="confirmChainServices"
      >
        Continuar · {{ money(chainTotal) }} · {{ chainMinutes }} min
      </button>

      <p v-if="!page.services.length && !packages.length" class="text-sm text-slate-500">
        Este negocio todavía no ofrece reservas en línea. Escríbenos y te agendamos.
      </p>
    </div>

    <!-- 2. Con quién -->
    <div v-else-if="step === 2" class="flex flex-col gap-3">
      <button
        type="button"
        class="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left active:bg-slate-50"
        @click="pickResource(null)"
      >
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
        >
          ✦
        </span>
        <span class="min-w-0 flex-1">
          <span class="block font-medium text-slate-900">Quien esté disponible</span>
          <span class="mt-0.5 block text-xs text-slate-500">Suele haber más horas para elegir.</span>
        </span>
        <span class="shrink-0 text-slate-300">›</span>
      </button>

      <button
        v-for="person in resources"
        :key="person.id"
        type="button"
        class="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left active:bg-slate-50"
        @click="pickResource(person.id)"
      >
        <img
          v-if="person.photo_url"
          :src="person.photo_url"
          :alt="person.name"
          class="h-11 w-11 shrink-0 rounded-full object-cover"
        />
        <span
          v-else
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 font-medium text-slate-500"
        >
          {{ person.name.charAt(0) }}
        </span>
        <span class="min-w-0 flex-1 font-medium text-slate-900">{{ person.name }}</span>
        <span class="shrink-0 text-slate-300">›</span>
      </button>

      <p v-if="isChain" class="text-xs text-slate-500">
        Si esa persona no presta alguno de los servicios, te decimos quién toma esa parte en vez de
        esconderte la hora.
      </p>
    </div>

    <!-- 3. Cuándo -->
    <div v-else-if="step === 3" class="flex flex-col gap-4">
      <!-- Fichas rápidas primero: la mayoría reserva para esta semana y así no
           tiene que leer un calendario. -->
      <div v-if="quickDays.length">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Los días más cercanos
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="day in quickDays"
            :key="day.date"
            type="button"
            class="min-h-11 rounded-xl border px-3 text-sm capitalize transition"
            :class="
              date === day.date
                ? 'border-slate-900 bg-slate-900 font-medium text-white'
                : 'border-slate-200 bg-white text-slate-700'
            "
            @click="pickDay(day.date)"
          >
            {{ dayChip(day.date) }}
          </button>
        </div>
      </div>

      <p v-else-if="loadingDays" class="text-sm text-slate-500">Buscando disponibilidad…</p>

      <div>
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          O elige en el calendario
        </p>
        <MonthCalendar
          :model-value="date"
          :available="monthAvailability"
          :min="today"
          :loading="loadingMonth"
          @update:model-value="pickDay"
          @month-change="monthFrom = $event < today ? today : $event"
        />
      </div>

      <template v-if="date">
        <div>
          <p class="mb-2 text-sm font-medium first-letter:uppercase text-slate-800">{{ dayLabel(date) }}</p>

          <p v-if="loadingHoras" class="text-sm text-slate-500">Cargando horas…</p>

          <!-- Visita de varias partes: la hora es la de TODA la visita, no la
               del primer servicio. -->
          <template v-else-if="isChain">
            <p v-if="!chainByFranja.length" class="text-sm text-slate-500">
              Ese día no cabe todo lo que elegiste. Prueba con otro día o con menos servicios.
            </p>

            <div v-for="grupo in chainByFranja" :key="grupo.key" class="mb-3">
              <p class="mb-1.5 text-xs text-slate-400">{{ grupo.label }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="(slot, i) in grupo.slots"
                  :key="i"
                  type="button"
                  class="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 active:bg-slate-50"
                  @click="pickChain(slot)"
                >
                  {{ slot.label }}
                  <!-- Si se pidió a alguien, el ✓ es que se le respetó. Marcar
                       en verde una hora que quedó entera con OTRA persona sería
                       decirle que sí a algo que no pidió. -->
                  <span
                    v-if="resourceId ? slot.preferred_honored : slot.same_person"
                    class="ml-0.5 text-xs text-emerald-600"
                    title="Toda la visita con la misma persona"
                  >
                    ✓
                  </span>
                  <span v-else class="ml-0.5 text-xs text-amber-600" title="Cambia de persona">
                    ⇄
                  </span>
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <p v-if="!slotsByFranja.length" class="text-sm text-slate-500">
              No quedan horas ese día. Prueba con otro.
            </p>

            <div v-for="grupo in slotsByFranja" :key="grupo.key" class="mb-3">
              <p class="mb-1.5 text-xs text-slate-400">{{ grupo.label }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="(slot, i) in grupo.slots"
                  :key="i"
                  type="button"
                  class="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 active:bg-slate-50"
                  @click="pickSlot(slot)"
                >
                  {{ slot.label }}
                  <!-- Con "cualquiera" hay que decir con quién queda: enterarse
                       al llegar al local de que atiende otra persona es peor
                       que saberlo antes. -->
                  <span v-if="resourceId === null" class="ml-1 text-xs text-slate-400">
                    {{ slot.resource_name }}
                  </span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>

    <!-- 4. Datos -->
    <form v-else class="flex flex-col gap-4" @submit.prevent="submit">
      <div class="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        <template v-if="chosenChain">
          <p class="font-semibold text-slate-900">
            {{ pack ? pack.name : 'Tu visita' }}
          </p>
          <p>
            {{ money(pack ? pack.total : chainTotal) }}
            <span v-if="pack && pack.discount > 0" class="text-emerald-700">
              · ahorras {{ money(pack.discount) }}
            </span>
            <span v-else>· {{ chainMinutes }} min</span>
          </p>
          <p class="mt-1 first-letter:uppercase">{{ date ? dayLabel(date) : '' }}</p>
          <!-- Con quién queda cada parte, y por qué, antes de confirmar. Un
               cambio de persona que se descubre en el local es una discusión
               en el mostrador. -->
          <p v-for="leg in chosenChain.legs" :key="leg.service_id" class="mt-1 text-xs">
            {{ leg.label }} · {{ leg.service_name }} con {{ leg.resource_name }}
            <span v-if="legNote(leg)" class="text-amber-700">— {{ legNote(leg) }}</span>
          </p>
        </template>

        <template v-else>
          <p class="font-semibold text-slate-900">{{ service?.name }}</p>
          <p v-if="service">{{ money(service.price) }} · {{ service.duration_min }} min</p>
          <p class="mt-1 first-letter:uppercase">
            {{ date ? dayLabel(date) : '' }}
            <span v-if="startsAt">
              a las
              {{
                new Date(startsAt).toLocaleTimeString('es-CO', {
                  hour: 'numeric',
                  minute: '2-digit',
                })
              }}
            </span>
          </p>
        </template>
      </div>

      <!-- `text-base` en todos los campos: por debajo de 16px iOS hace zoom al
           enfocar y el formulario queda corrido. -->
      <label class="text-sm font-medium text-slate-700">
        Tu nombre
        <input
          v-model="name"
          type="text"
          autocomplete="name"
          enterkeyhint="next"
          class="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900 outline-none focus:border-slate-900"
          :disabled="booking"
          required
        />
      </label>

      <label class="text-sm font-medium text-slate-700">
        Tu WhatsApp
        <input
          v-model="phone"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          enterkeyhint="next"
          class="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900 outline-none focus:border-slate-900"
          :disabled="booking"
          required
        />
        <span class="mt-1 block text-xs font-normal text-slate-500">
          Para confirmarte la cita. No lo usamos para nada más.
        </span>
      </label>

      <label class="text-sm font-medium text-slate-700">
        Tu correo
        <input
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="email"
          autocapitalize="off"
          spellcheck="false"
          enterkeyhint="next"
          class="mt-1 min-h-12 w-full rounded-xl border px-3 text-base text-slate-900 outline-none focus:border-slate-900"
          :class="email && !emailValido ? 'border-amber-400' : 'border-slate-300'"
          :disabled="booking"
          required
        />
        <span v-if="email && !emailValido" class="mt-1 block text-xs font-normal text-amber-700">
          Revisa el correo, parece incompleto.
        </span>
      </label>

      <label class="text-sm font-medium text-slate-700">
        Algo que debamos saber (opcional)
        <textarea
          v-model="notes"
          rows="2"
          enterkeyhint="done"
          class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none focus:border-slate-900"
          :disabled="booking"
        />
      </label>

      <!-- El abono se dice antes de confirmar, con el monto exacto y con qué
           pasa si no llega. Una cita "reservada" que en realidad no lo está
           es peor que no haber reservado. -->
      <div
        v-if="depositAmount > 0"
        class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
      >
        <p class="font-medium">Para separar tu cita pedimos {{ money(depositAmount) }}</p>
        <p v-if="deposit?.instructions" class="mt-1 text-xs">{{ deposit.instructions }}</p>
        <p class="mt-1 text-xs">
          Te damos los datos al confirmar. Tu cita queda apartada cuando recibamos el abono, y se
          descuenta de lo que pagues ese día.
        </p>
      </div>

      <p v-if="error" class="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <!-- El botón va en el flujo del documento, no fijo abajo: en el navegador
           de WhatsApp la barra del sistema tapa ese borde. -->
      <button
        type="submit"
        class="min-h-12 rounded-xl bg-slate-900 px-4 py-3 font-medium text-white transition active:bg-slate-700 disabled:opacity-40"
        :disabled="!canSubmit"
      >
        {{ booking ? 'Reservando…' : 'Confirmar reserva' }}
      </button>
    </form>
  </div>
</template>
