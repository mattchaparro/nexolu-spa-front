<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'

import {
  useCreatePublicBooking,
  usePublicDays,
  usePublicSlots,
  type BookingResult,
  type PublicPage,
  type PublicResource,
  type PublicService,
} from '../composables/usePublicBooking'

const props = defineProps<{ slug: string; page: PublicPage; preselected: number | null }>()

const slug = computed(() => props.slug)

/*
 * Cuatro pasos, uno por pantalla. Un formulario único con todo a la vez cabe
 * en un monitor pero no en un teléfono, y por el teléfono es por donde reserva
 * la gente.
 */
const step = ref<1 | 2 | 3 | 4>(1)

const serviceId = ref<number | null>(null)
const resourceId = ref<number | null>(null)
const date = ref<string | null>(null)
const startsAt = ref<string | null>(null)
const chosenResourceId = ref<number | null>(null)

const name = ref('')
const phone = ref('')
const notes = ref('')
const error = ref<string | null>(null)
const done = ref<BookingResult | null>(null)

const today = new Date().toISOString().slice(0, 10)
const from = ref(today)

const { data: daysData, isFetching: loadingDays } = usePublicDays(slug, serviceId, from, resourceId)
const { data: slotsData, isFetching: loadingSlots } = usePublicSlots(slug, serviceId, date, resourceId)
const { mutateAsync: book, isPending: booking } = useCreatePublicBooking(slug)

const service = computed<PublicService | null>(
  () => props.page.services.find((s) => s.id === serviceId.value) ?? null,
)

/** Sólo quien presta ESTE servicio: ofrecer al resto lleva a un hueco vacío. */
const resources = computed<PublicResource[]>(() =>
  props.page.resources.filter((r) => service.value?.resource_ids.includes(r.id) ?? false),
)

watch(
  () => props.preselected,
  (id) => {
    if (id !== null) pickService(id)
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
  resourceId.value = null
  date.value = null
  startsAt.value = null
  step.value = 2
}

function pickResource(id: number | null): void {
  resourceId.value = id
  date.value = null
  startsAt.value = null
  step.value = 3
}

function pickSlot(slot: { starts_at: string; resource_id: number }): void {
  startsAt.value = slot.starts_at
  // Con "cualquiera", el hueco elegido decide quién atiende.
  chosenResourceId.value = slot.resource_id
  step.value = 4
}

function back(): void {
  error.value = null
  if (step.value > 1) step.value = (step.value - 1) as 1 | 2 | 3
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
  if (!serviceId.value || !startsAt.value) return
  error.value = null

  try {
    done.value = await book({
      service_id: serviceId.value,
      resource_id: chosenResourceId.value ?? resourceId.value!,
      starts_at: startsAt.value,
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
      step.value = 3
    }
  }
}

function restart(): void {
  done.value = null
  step.value = 1
  serviceId.value = null
  resourceId.value = null
  date.value = null
  startsAt.value = null
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
    <p class="mt-3 text-emerald-900">
      <b>{{ done.service }}</b> con {{ done.resource }}<br />
      {{ done.date_label }} a las {{ done.time_label }}
    </p>
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
      <span v-if="service" class="truncate">· {{ service.name }}</span>
    </div>

    <!-- 1. Servicio -->
    <div v-if="step === 1" class="grid gap-3 sm:grid-cols-2">
      <button
        v-for="item in page.services"
        :key="item.id"
        type="button"
        class="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-400"
        @click="pickService(item.id)"
      >
        <img
          v-if="item.image_url"
          :src="item.image_url"
          :alt="item.name"
          class="h-16 w-16 shrink-0 rounded object-cover"
        />
        <span class="min-w-0 flex-1">
          <span class="block font-medium text-slate-800">{{ item.name }}</span>
          <span v-if="item.description" class="mt-0.5 block line-clamp-2 text-xs text-slate-500">
            {{ item.description }}
          </span>
          <span class="mt-1 block text-sm text-slate-600">
            {{ money(item.price) }} · {{ item.duration_min }} min
          </span>
        </span>
      </button>

      <p v-if="!page.services.length" class="text-sm text-slate-500 sm:col-span-2">
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

        <p v-if="loadingSlots" class="text-sm text-slate-500">Cargando…</p>

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
