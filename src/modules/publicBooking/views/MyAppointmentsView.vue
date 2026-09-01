<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import {
  useCancelAppointment,
  useMyAppointments,
  usePortalSlots,
  useReschedule,
  type PortalAppointment,
} from '../composables/useClientPortal'

/*
 * "Mis citas": lo que la clienta hace con las suyas, sin cuenta.
 *
 * Se abre desde el enlace que le llegó por WhatsApp. Pensada para ese
 * navegador embebido: pantalla corta, dedo gordo, y alguien que entra a hacer
 * UNA cosa — mover la hora o cancelar — no a explorar.
 */
const route = useRoute()

const slug = computed(() => String(route.params.businessSlug ?? ''))
const token = computed(() => String(route.params.token ?? ''))

const { data, isLoading, isError } = useMyAppointments(slug, token)

/** La cita que se está moviendo, si hay alguna. */
const moviendo = ref<PortalAppointment | null>(null)
const fecha = ref<string | null>(null)
const aviso = ref<string | null>(null)
const error = ref<string | null>(null)

const movingId = computed(() => moviendo.value?.id ?? null)

const { data: slotsData, isFetching: cargandoHoras } = usePortalSlots(slug, token, movingId, fecha)
const { mutateAsync: reagendar, isPending: reagendando } = useReschedule(slug, token)
const { mutateAsync: cancelar, isPending: cancelando } = useCancelAppointment(slug, token)

const hoy = new Date().toISOString().slice(0, 10)

function abrirCambio(cita: PortalAppointment): void {
  error.value = null
  aviso.value = null
  moviendo.value = cita
  // Arranca en el día de la cita: casi siempre se mueve unas horas, no un mes.
  fecha.value = cita.starts_at.slice(0, 10)
}

function mensaje(e: unknown, porDefecto: string): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto
  )
}

async function elegirHora(startsAt: string): Promise<void> {
  error.value = null

  try {
    const r = await reagendar({ appointmentId: moviendo.value!.id, starts_at: startsAt })
    moviendo.value = null
    aviso.value = `${r.message} Quedó el ${r.date_label} a las ${r.time_label}.`
  } catch (e) {
    error.value = mensaje(e, 'No pudimos mover tu cita.')
  }
}

async function anular(cita: PortalAppointment): Promise<void> {
  if (!window.confirm('¿Seguro que quieres cancelar esta cita?')) return

  error.value = null

  try {
    const r = await cancelar(cita.id)
    moviendo.value = null
    aviso.value = r.message
  } catch (e) {
    error.value = mensaje(e, 'No pudimos cancelar tu cita.')
  }
}

const whatsappUrl = computed(() => {
  const numero = data.value?.business.whatsapp?.replace(/\D/g, '')
  return numero ? `https://wa.me/${numero}` : null
})
</script>

<template>
  <div class="min-h-screen bg-white">
    <p v-if="isLoading" class="p-10 text-center text-slate-500">Cargando…</p>

    <!-- Un enlace vencido, mal copiado o de otra persona se ve igual: no es
         asunto de quien pasa por la URL cuál de las tres. -->
    <div v-else-if="isError || !data" class="flex min-h-screen items-center justify-center p-8">
      <div class="max-w-sm text-center">
        <p class="text-lg font-medium text-slate-800">Este enlace ya no sirve</p>
        <p class="mt-2 text-sm text-slate-500">
          Escríbele al negocio y con gusto te ayudan con tu cita.
        </p>
      </div>
    </div>

    <template v-else>
      <header class="border-b border-slate-100 px-5 py-4">
        <div class="mx-auto flex max-w-lg items-center gap-3">
          <img
            v-if="data.business.logo_url"
            :src="data.business.logo_url"
            :alt="data.business.name"
            class="h-10 w-10 rounded-lg object-cover"
          />
          <div class="min-w-0">
            <p class="truncate font-semibold text-slate-900">{{ data.business.name }}</p>
            <p class="text-xs text-slate-500">Hola, {{ data.client.name }}</p>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-lg px-5 py-6">
        <p v-if="aviso" class="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {{ aviso }}
        </p>
        <p v-if="error" class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {{ error }}
        </p>

        <h1 class="mb-4 text-lg font-semibold text-slate-900">Tus próximas citas</h1>

        <p
          v-if="!data.appointments.length"
          class="rounded-lg bg-slate-100 px-4 py-8 text-center text-sm text-slate-600"
        >
          No tienes citas próximas.
        </p>

        <div v-else class="flex flex-col gap-3">
          <article
            v-for="cita in data.appointments"
            :key="cita.id"
            class="rounded-xl border border-slate-200 p-4"
          >
            <p class="font-medium text-slate-900 first-letter:uppercase">{{ cita.date_label }}</p>
            <p class="text-sm text-slate-600">{{ cita.time_label }}</p>

            <p class="mt-2 text-sm text-slate-700">
              <span v-for="(item, i) in cita.items" :key="i">
                <span v-if="i > 0"> + </span>{{ item.service }}
                <span v-if="item.resource" class="text-slate-500">con {{ item.resource }}</span>
              </span>
            </p>

            <!-- La sede, con su dirección. Es lo único que evita que alguien
                 llegue al local equivocado con una cita perfectamente válida. -->
            <p v-if="cita.location" class="mt-1 text-sm text-slate-500">
              <i class="pi pi-map-marker text-xs" />
              <a
                v-if="cita.maps_url"
                :href="cita.maps_url"
                target="_blank"
                rel="noopener"
                class="underline"
              >
                {{ cita.location
                }}<span v-if="cita.location_address"> · {{ cita.location_address }}</span>
              </a>
              <span v-else>
                {{ cita.location
                }}<span v-if="cita.location_address"> · {{ cita.location_address }}</span>
              </span>
            </p>

            <!-- Por qué no se puede tocar, dicho ANTES de tocar nada: un botón
                 que existe y siempre falla es peor que uno que no está. -->
            <p
              v-if="!cita.can_change"
              class="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600"
            >
              {{ cita.refusal }}
              <a
                v-if="whatsappUrl"
                :href="whatsappUrl"
                target="_blank"
                rel="noopener"
                class="underline"
              >
                Escribir por WhatsApp
              </a>
            </p>

            <div v-else class="mt-3 flex gap-2">
              <button
                type="button"
                class="min-h-11 flex-1 rounded-lg border border-slate-800 bg-slate-800 px-4 text-sm text-white"
                @click="abrirCambio(cita)"
              >
                Cambiar la hora
              </button>
              <button
                type="button"
                class="min-h-11 rounded-lg border border-slate-200 px-4 text-sm text-slate-600"
                :disabled="cancelando"
                @click="anular(cita)"
              >
                Cancelar
              </button>
            </div>

            <!-- Elegir la hora nueva, dentro de la misma tarjeta: mandarla a
                 otra pantalla en un navegador de WhatsApp es perder el hilo. -->
            <div v-if="moviendo?.id === cita.id" class="mt-4 border-t border-slate-100 pt-3">
              <label class="text-sm text-slate-700">
                ¿Qué día?
                <input
                  v-model="fecha"
                  type="date"
                  :min="hoy"
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base text-slate-900"
                />
              </label>

              <p v-if="cargandoHoras" class="mt-3 text-sm text-slate-500">Buscando horas…</p>

              <!-- Una visita de varios servicios no se mueve sola: cada parte
                   puede ser de una persona distinta. -->
              <p v-else-if="slotsData?.message" class="mt-3 text-sm text-slate-600">
                {{ slotsData.message }}
                <a
                  v-if="whatsappUrl"
                  :href="whatsappUrl"
                  target="_blank"
                  rel="noopener"
                  class="underline"
                >
                  Escribir por WhatsApp
                </a>
              </p>

              <p v-else-if="!slotsData?.slots.length" class="mt-3 text-sm text-slate-600">
                Ese día no queda nada libre con {{ slotsData?.resource_name }}. Prueba otro.
              </p>

              <div v-else class="mt-3">
                <p class="mb-2 text-xs text-slate-500">
                  Horas libres con {{ slotsData.resource_name }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="hueco in slotsData.slots"
                    :key="hueco.starts_at"
                    type="button"
                    class="min-h-11 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"
                    :disabled="reagendando"
                    @click="elegirHora(hueco.starts_at)"
                  >
                    {{ hueco.label }}
                  </button>
                </div>
              </div>

              <button
                type="button"
                class="mt-3 text-sm text-slate-500 underline"
                @click="moviendo = null"
              >
                Dejarla como está
              </button>
            </div>
          </article>
        </div>

        <p class="mt-8 text-center text-xs text-slate-400">
          ¿Necesitas otra cosa?
          <a
            v-if="whatsappUrl"
            :href="whatsappUrl"
            target="_blank"
            rel="noopener"
            class="underline"
          >
            Escríbenos por WhatsApp
          </a>
        </p>
      </main>
    </template>
  </div>
</template>
