<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'

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
 * Cuatro pasos, uno por pantalla. Un formulario único con todo a la vez cabe
 * en un monitor pero no en un teléfono, y por el teléfono es por donde reserva
 * la gente.
 */
const step = ref<1 | 2 | 3 | 4>(1)

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
const notes = ref('')
const error = ref<string | null>(null)
const done = ref<BookingResult | null>(null)

const today = new Date().toISOString().slice(0, 10)
const from = ref(today)

/*
 * Para un combo, los días se consultan con su PRIMER servicio.
 *
 * Es un filtro necesario pero no suficiente: un día sin hueco para el primero
 * tampoco lo tiene para la cadena, así que se puede apagar sin equivocarse.
 * Al revés no vale, y por eso el día que queda encendido lo confirma la
 * cadena. Calcular la cadena completa de catorce días para pintar la tira
 * sería caro y nadie lo miraría.
 */
const packages = computed<PublicPackage[]>(() => props.page.packages ?? [])

const pack = computed<PublicPackage | null>(
  () => packages.value.find((p) => p.id === packageId.value) ?? null,
)

const daysServiceId = computed(
  () => serviceId.value ?? pack.value?.services[0]?.id ?? chainIds.value[0] ?? null,
)

const { data: daysData, isFetching: loadingDays } = usePublicDays(slug, daysServiceId, from, resourceId)
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

/** Qué se está reservando, dicho en una línea. */
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

/**
 * Quién se puede pedir.
 *
 * Para un servicio suelto, sólo quien lo presta: ofrecer al resto lleva a un
 * hueco vacío. Para un combo, quien preste AL MENOS UNO -- pedirla es una
 * preferencia, y el servidor dice qué parte tuvo que tomar otra persona en
 * vez de esconder la hora entera.
 */
const resources = computed<PublicResource[]>(() => {
  const varios = pack.value
    ? pack.value.services.map((s) => s.id)
    : chainIds.value

  if (varios.length) {
    return props.page.resources.filter((r) =>
      props.page.services.some((s) => varios.includes(s.id) && s.resource_ids.includes(r.id)),
    )
  }

  return props.page.resources.filter((r) => service.value?.resource_ids.includes(r.id) ?? false)
})

/** Por qué esa parte quedó con otra persona, dicho como en el mostrador. */
function legNote(leg: PublicChainLeg): string | null {
  if (leg.changed_reason === null) {
    return null
  }

  const quien = resources.value.find((r) => r.id === resourceId.value)?.name

  if (leg.changed_reason === 'skill') {
    return quien ? `${quien} no hace este servicio` : 'Lo toma otra persona'
  }

  return quien ? `${quien} no está libre a esa hora` : 'Lo toma otra persona por disponibilidad'
}

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

function money(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: props.page.business.currency ?? 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function pickService(id: number): void {
  serviceId.value = id
  packageId.value = null
  chainIds.value = []
  resourceId.value = null
  date.value = null
  startsAt.value = null
  chosenChain.value = null
  step.value = 2
}

function pickPackage(id: number): void {
  packageId.value = id
  serviceId.value = null
  chainIds.value = []
  resourceId.value = null
  date.value = null
  startsAt.value = null
  chosenChain.value = null
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
  resourceId.value = null
  date.value = null
  startsAt.value = null
  chosenChain.value = null
  step.value = 2
}

function pickResource(id: number | null): void {
  resourceId.value = id
  date.value = null
  startsAt.value = null
  chosenChain.value = null
  step.value = 3
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

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

const canSubmit = computed(
  () => name.value.trim().length > 2 && phone.value.replace(/\D/g, '').length >= 7 && !booking.value,
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
  resourceId.value = null
  date.value = null
  startsAt.value = null
  chosenChain.value = null
  name.value = ''
  phone.value = ''
  notes.value = ''
}
</script>

<template>
  <!-- Confirmación -->
  <div v-if="done" class="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
    <p class="text-3xl">✓</p>
    <h3 class="mt-2 text-lg font-semibold text-emerald-900">{{ done.message }}</h3>
    <p v-if="done.items.length < 2" class="mt-3 text-emerald-900">
      <b>{{ done.service }}</b> con {{ done.resource }}<br />
      {{ done.date_label }} a las {{ done.time_label }}
    </p>

    <!-- Visita de varios servicios: se detalla parte por parte. Enterarse al
         llegar de que la segunda mitad la atiende otra persona es lo que hay
         que evitar. -->
    <div v-else class="mt-3 text-emerald-900">
      <p v-if="done.package" class="font-semibold">{{ done.package }}</p>
      <p>{{ done.date_label }}</p>
      <p v-for="(item, i) in done.items" :key="i" class="mt-1 text-sm">
        {{ item.time_label }} · {{ item.service }} con {{ item.resource }}
      </p>
    </div>
    <p class="mt-3 text-sm text-emerald-800">
      Si necesitas cambiarla o cancelarla, escríbenos.
      <!-- Cancelar no se puede desde acá a propósito: una URL pública que
           cancela citas es una URL pública que cancela las de otra persona. -->
    </p>
    <button type="button" class="mt-4 text-sm text-emerald-900 underline" @click="restart">
      Reservar otra cita
    </button>
  </div>

  <div v-else>
    <!-- Migas -->
    <div class="mb-4 flex items-center gap-2 text-xs text-slate-500">
      <button v-if="step > 1" type="button" class="underline" @click="back">Atrás</button>
      <span>Paso {{ step }} de 4</span>
      <span v-if="whatLabel" class="truncate">· {{ whatLabel }}</span>
    </div>

    <!-- 1. Qué se va a hacer -->
    <div v-if="step === 1" class="grid gap-3 sm:grid-cols-2">
      <!-- Los combos van primero y marcados: es lo que el negocio quiere
           vender, y lo que le sale más barato a quien reserva. -->
      <template v-if="packages.length">
        <p class="text-sm font-medium text-slate-700 sm:col-span-2">Combos</p>

        <button
          v-for="combo in packages"
          :key="`p${combo.id}`"
          type="button"
          class="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-left transition hover:border-emerald-400"
          @click="pickPackage(combo.id)"
        >
          <img
            v-if="combo.image_url"
            :src="combo.image_url"
            :alt="combo.name"
            class="h-16 w-16 shrink-0 rounded object-cover"
          />
          <span class="min-w-0 flex-1">
            <span class="block font-medium text-slate-800">{{ combo.name }}</span>
            <span class="mt-0.5 block truncate text-xs text-slate-500">
              {{ combo.services.map((s) => s.name).join(' + ') }}
            </span>
            <span class="mt-1 block text-sm text-slate-600">
              <b>{{ money(combo.total) }}</b>
              <span v-if="combo.discount > 0" class="ml-1 text-slate-400 line-through">
                {{ money(combo.list_total) }}
              </span>
              · {{ combo.total_minutes }} min
            </span>
            <span v-if="combo.discount > 0" class="mt-0.5 block text-xs font-medium text-emerald-700">
              Ahorras {{ money(combo.discount) }}
            </span>
          </span>
        </button>

        <p class="mt-2 text-sm font-medium text-slate-700 sm:col-span-2">Servicios</p>
      </template>

      <!-- Armar una visita de varias cosas.
           No se pone de entrada: tocar un servicio y seguir es el camino del
           90% de la gente, y meterle un paso de "marca y confirma" a ese caso
           lo empeora para todos. -->
      <button
        v-if="page.services.length > 1"
        type="button"
        class="text-left text-sm text-slate-500 underline sm:col-span-2"
        @click="armando = !armando"
      >
        {{ armando ? 'Prefiero un solo servicio' : '¿Te vas a hacer varias cosas? Arma tu visita' }}
      </button>

      <button
        v-for="item in page.services"
        :key="item.id"
        type="button"
        class="flex gap-3 rounded-lg border bg-white p-3 text-left transition"
        :class="
          armando && chainIds.includes(item.id)
            ? 'border-slate-800 ring-1 ring-slate-800'
            : 'border-slate-200 hover:border-slate-400'
        "
        @click="armando ? toggleChainService(item.id) : pickService(item.id)"
      >
        <img
          v-if="item.image_url"
          :src="item.image_url"
          :alt="item.name"
          class="h-16 w-16 shrink-0 rounded object-cover"
        />
        <span class="min-w-0 flex-1">
          <span class="block font-medium text-slate-800">
            {{ item.name }}
            <!-- El número dice el orden de la visita, que es el orden en que
                 se marcó: primero las manos, después los pies. -->
            <span v-if="armando && chainIds.includes(item.id)" class="ml-1 text-xs text-slate-500">
              {{ chainIds.indexOf(item.id) + 1 }}
            </span>
          </span>
          <span v-if="item.description" class="mt-0.5 block line-clamp-2 text-xs text-slate-500">
            {{ item.description }}
          </span>
          <span class="mt-1 block text-sm text-slate-600">
            {{ money(item.price) }} · {{ item.duration_min }} min
          </span>
        </span>
      </button>

      <button
        v-if="armando && chainIds.length"
        type="button"
        class="rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-800 sm:col-span-2"
        @click="confirmChainServices"
      >
        Continuar · {{ chainIds.length }} servicios · {{ money(chainTotal) }} · {{ chainMinutes }} min
      </button>

      <p v-if="!page.services.length && !packages.length" class="text-sm text-slate-500 sm:col-span-2">
        Este negocio todavía no ofrece reservas en línea. Escríbenos y te agendamos.
      </p>
    </div>

    <!-- 2. Profesional -->
    <div v-else-if="step === 2" class="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        class="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400"
        @click="pickResource(null)"
      >
        <span class="block font-medium text-slate-800">Cualquiera</span>
        <span class="mt-0.5 block text-xs text-slate-500">
          La primera que tenga disponible. Suele haber más horas.
        </span>
      </button>

      <button
        v-for="person in resources"
        :key="person.id"
        type="button"
        class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400"
        @click="pickResource(person.id)"
      >
        <img
          v-if="person.photo_url"
          :src="person.photo_url"
          :alt="person.name"
          class="h-10 w-10 shrink-0 rounded-full object-cover"
        />
        <span
          v-else
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500"
        >
          {{ person.name.charAt(0) }}
        </span>
        <span class="font-medium text-slate-800">{{ person.name }}</span>
      </button>
    </div>

    <!-- 3. Día y hora -->
    <div v-else-if="step === 3">
      <p class="mb-2 text-sm font-medium text-slate-700">Elige el día</p>

      <p v-if="loadingDays" class="text-sm text-slate-500">Buscando disponibilidad…</p>

      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="day in daysData?.days ?? []"
          :key="day.date"
          type="button"
          class="rounded-lg border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40"
          :class="
            date === day.date
              ? 'border-slate-800 bg-slate-800 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
          "
          :disabled="!day.has_slots"
          @click="date = day.date"
        >
          {{ dayLabel(day.date) }}
        </button>
      </div>

      <template v-if="date">
        <p class="mb-2 mt-5 text-sm font-medium text-slate-700">Elige la hora</p>

        <p v-if="loadingSlots || loadingChain" class="text-sm text-slate-500">Cargando…</p>

        <!-- Visita de varias partes: la hora es la de TODA la visita, no la
             del primer servicio. Cada botón sabe si todo queda con la misma
             persona. -->
        <template v-else-if="isChain">
          <p v-if="!chainData?.slots.length" class="text-sm text-slate-500">
            Ese día no cabe todo lo que elegiste. Prueba con otro día o con menos servicios.
          </p>

          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="(slot, i) in chainData.slots"
              :key="i"
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400"
              @click="pickChain(slot)"
            >
              {{ slot.label }}
              <!-- Si se pidió a alguien, el ✓ es que se le respetó. Marcar en
                   verde una hora que quedó entera con OTRA persona sería
                   decirle que sí a algo que no pidió. -->
              <span
                v-if="resourceId ? slot.preferred_honored : slot.same_person"
                class="ml-1 text-xs text-emerald-600"
                title="Toda la visita con la misma persona"
              >
                ✓
              </span>
              <span v-else class="ml-1 text-xs text-amber-600" title="Cambia de persona">
                ⇄
              </span>
            </button>
          </div>
        </template>

        <p v-else-if="!slotsData?.slots.length" class="text-sm text-slate-500">
          No quedan horas ese día. Prueba con otro.
        </p>

        <div v-else class="flex flex-wrap gap-2">
          <button
            v-for="(slot, i) in slotsData.slots"
            :key="i"
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400"
            @click="pickSlot(slot)"
          >
            {{ slot.label }}
            <!-- Con "cualquiera" hay que decir con quién queda: enterarse al
                 llegar al local de que atiende otra persona es peor que
                 preguntarlo antes. -->
            <span v-if="resourceId === null" class="ml-1 text-xs text-slate-400">
              {{ slot.resource_name }}
            </span>
          </button>
        </div>
      </template>
    </div>

    <!-- 4. Datos -->
    <form v-else class="flex flex-col gap-3" @submit.prevent="submit">
      <div class="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <template v-if="chosenChain">
          <b>{{ pack ? pack.name : 'Tu visita' }}</b>
          · {{ money(pack ? pack.total : chainTotal) }}
          <span v-if="pack && pack.discount > 0" class="text-emerald-700">
            (ahorras {{ money(pack.discount) }})
          </span>
          <span v-else-if="!pack" class="text-slate-500">· {{ chainMinutes }} min</span>
          <br />
          {{ date ? dayLabel(date) : '' }}
          <!-- Con quién queda cada parte, y por qué, antes de confirmar. Un
               cambio de persona que se descubre en el local es una discusión
               en el mostrador. -->
          <span v-for="leg in chosenChain.legs" :key="leg.service_id" class="mt-1 block text-xs">
            {{ leg.label }} · {{ leg.service_name }} con {{ leg.resource_name }}
            <span v-if="legNote(leg)" class="text-amber-700">— {{ legNote(leg) }}</span>
          </span>
        </template>

        <template v-else>
          <b>{{ service?.name }}</b>
          <span v-if="service"> · {{ money(service.price) }} · {{ service.duration_min }} min</span>
          <br />
          {{ date ? dayLabel(date) : '' }}
          <span v-if="startsAt">
            a las
            {{
              new Date(startsAt).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
            }}
          </span>
        </template>
      </div>

      <label class="text-sm text-slate-700">
        Tu nombre
        <input
          v-model="name"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
          :disabled="booking"
          required
        />
      </label>

      <label class="text-sm text-slate-700">
        Tu WhatsApp
        <input
          v-model="phone"
          inputmode="tel"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
          :disabled="booking"
          required
        />
        <span class="mt-1 block text-xs text-slate-500">
          Es para confirmarte la cita. No lo usamos para nada más.
        </span>
      </label>

      <label class="text-sm text-slate-700">
        Algo que debamos saber (opcional)
        <textarea
          v-model="notes"
          rows="2"
          class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800"
          :disabled="booking"
        />
      </label>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <button
        type="submit"
        class="rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        :disabled="!canSubmit"
      >
        {{ booking ? 'Reservando…' : 'Confirmar reserva' }}
      </button>
    </form>
  </div>
</template>
