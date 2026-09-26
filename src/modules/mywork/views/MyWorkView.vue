<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useAuthStore } from '@/stores/auth.store'
import { NxButton } from '@/ui'

import CheckoutModal from '@/modules/agenda/components/CheckoutModal.vue'
import {
  useAppointment,
  useAppointments,
  type Appointment,
} from '@/modules/agenda/composables/useAppointments'
import { useMoney } from '@/modules/cash/composables/useMoney'
import { toLocalDateIso } from '@/utils/toLocalDateIso'

import MyRatingsCard from '../components/MyRatingsCard.vue'
import WalkInModal from '../components/WalkInModal.vue'
import { useMyWork } from '../composables/useMyWork'

const auth = useAuthStore()
const { notify } = useSystemAlert()
const { money } = useMoney()

const { data, isLoading } = useMyWork()

const today = ref(toLocalDateIso())
const { data: appointments } = useAppointments(today)

const walkInOpen = ref(false)
const toCheckout = ref<Appointment | null>(null)

const myResourceId = computed(() => data.value?.resource?.id ?? null)

/*
 * Cobrar una cita, sea de hoy o de la semana pasada.
 *
 * Antes se buscaba dentro de la lista de HOY, y "lo que atendió y no cobró" no
 * cabe en un día -- ese es justamente el punto de esa lista, que no se pierda
 * ninguna. Una cita del jueves nunca estaba ahí y quien iba a cobrarla veía
 * "no encontramos esa cita, recarga la página": un mensaje que además proponía
 * algo que no arreglaba nada, porque recargar volvía a traer sólo el día de
 * hoy.
 *
 * Si está en la lista del día se usa esa -- es instantáneo y es el caso
 * normal. Si no, se pide por id.
 */
const pidiendoCita = ref<number | null>(null)
const { data: citaPedida, isFetching: buscandoCita } = useAppointment(pidiendoCita)

function charge(appointmentId: number): void {
  const enElDia = appointments.value?.find((a) => a.id === appointmentId)

  if (enElDia) {
    toCheckout.value = enElDia

    return
  }

  pidiendoCita.value = appointmentId
}

// Llegó la que se pidió por id: se abre el cobro con ella.
watch(citaPedida, (cita) => {
  if (cita) {
    toCheckout.value = cita
    pidiendoCita.value = null
  }
})

/*
 * Los manejadores de dos pasos van en funciones, NO en la plantilla.
 *
 * Un `@saved="a = false
 notify(...)"` sin punto y coma lo rechaza el
 * compilador de plantillas de Vue, y la vista deja de cargar entera. Pasa solo:
 * se escribe en una linea, Prettier la parte en dos, y nadie lo nota hasta que
 * la pantalla no abre. Ya ocurrio antes -- por eso existe `routes.spec.ts`.
 */
function onWalkInSaved(): void {
  walkInOpen.value = false
  notify('Servicio registrado.', 'success')
}

function onCobrado(): void {
  toCheckout.value = null
  notify('Cobrado. La comisión quedó registrada.', 'success')
}

function onCancelada(): void {
  toCheckout.value = null
  notify('Cita cancelada.', 'success')
}

/*
 * Las fechas se leen a MEDIODÍA, no a medianoche.
 *
 * Un `2026-08-01` que el navegador interpreta como medianoche UTC se muestra
 * como 31 de julio en Colombia. Con las 12:00 no hay huso que lo corra de día.
 */
function diaLegible(iso: string | null, conMes = true): string {
  if (!iso) return '—'

  return new Date(`${iso}T12:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    ...(conMes ? { month: 'long' } : {}),
  })
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Sin confirmar',
  confirmed: 'Confirmada',
  in_progress: 'En curso',
  completed: 'Atendida',
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Mi día</h1>
        <p class="mt-1 text-sm text-slate-500">
          {{ data?.resource?.name ?? auth.user?.full_name }}
        </p>
      </div>
      <!-- El permiso tiene que ser el MISMO que pide la API (servicios.registrar
           O citas.crear). Con sólo `citas.crear`, quien atiende no veía este
           botón aunque el servidor sí la dejaba: una manicurista no puede
           crear citas ajenas, pero registrar lo que acaba de hacer es
           exactamente su trabajo. -->
      <NxButton
        v-if="auth.can('servicios.registrar') || auth.can('citas.crear')"
        @click="walkInOpen = true"
      >
        Servicio sin cita
      </NxButton>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p v-else-if="!data?.resource" class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600">
      {{ data?.message ?? 'Tu usuario no está asociado a nadie de la agenda.' }}
    </p>

    <template v-else>
      <!--
        Lo primero: cuánto lleva ganado hasta hoy, desde el último pago.
        Es la pregunta de toda manicurista, y la semana o el mes no la
        contestan -- el pago no corta por semanas, corta cuando se liquida.
        Es la MISMA cifra que ve quien paga. Debajo, lo de hoy.
      -->
      <div class="mb-6 grid gap-3 sm:grid-cols-2">
        <article
          v-if="data.to_date"
          class="rounded-lg border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2"
        >
          <p class="text-xs uppercase tracking-wide text-emerald-700">
            Llevas de comisión
            <span class="normal-case tracking-normal text-emerald-600">
              · desde el {{ diaLegible(data.to_date.since) }}
            </span>
          </p>
          <p class="mt-1 text-3xl font-semibold tabular-nums text-emerald-900">
            {{ money(data.to_date.commission) }}
          </p>
          <p class="text-xs text-emerald-800">
            {{ data.to_date.services }} servicio(s) · {{ money(data.to_date.charged) }} vendido
          </p>
          <p
            v-if="data.to_date.bonus > 0 || data.to_date.deduction > 0"
            class="mt-1 text-xs text-emerald-800"
          >
            Con bonos y descuentos, te quedan {{ money(data.to_date.net) }}.
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4 sm:col-span-2">
          <p class="text-xs uppercase tracking-wide text-slate-400">Hoy</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ money(data.today.commission) }}
            <span class="text-sm font-normal text-slate-500">de comisión</span>
          </p>
          <p class="text-xs text-slate-500">
            {{ data.today.services }} servicio(s) · {{ money(data.today.charged) }} vendido
          </p>
        </article>
      </div>

      <!-- Lo que atendió pero no cobró: es lo primero que tiene que resolver
           antes de irse, no un dato más. -->
      <div
        v-if="data.pending_checkout.length"
        class="mb-6 rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3"
      >
        <p class="text-sm font-medium text-amber-900">
          {{ data.pending_checkout.length }} servicio(s) sin cobrar
        </p>
        <div class="mt-2 flex flex-col gap-1">
          <div
            v-for="pending in data.pending_checkout"
            :key="pending.id"
            class="flex items-center justify-between gap-3 text-sm text-amber-900"
          >
            <span>
              <span class="tabular-nums">{{ pending.label }}</span>
              · {{ pending.client_name }} · {{ pending.service_name }}
            </span>
            <!-- `loading` mientras se pide la cita: si es de otro dia hay un
                 viaje al servidor, y sin esto se puede tocar dos veces. -->
            <NxButton
              v-if="auth.can('caja.cobrar')"
              variant="outline"
              size="sm"
              :loading="buscandoCita && pidiendoCita === pending.id"
              @click="charge(pending.id)"
            >
              Cobrar
            </NxButton>
          </div>
        </div>
      </div>

      <!-- Debajo de lo que gana y encima de la agenda del día: se ve al
           entrar, sin buscarla, pero no le tapa lo que vino a hacer. -->
      <div v-if="data.ratings" class="mb-6">
        <MyRatingsCard :ratings="data.ratings" />
      </div>

      <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
        Mi agenda de hoy
      </h2>

      <p
        v-if="!data.agenda.length"
        class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600"
      >
        No tienes citas hoy.
      </p>

      <div v-else class="flex flex-col gap-2">
        <article
          v-for="row in data.agenda"
          :key="row.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
          :class="{ 'border-emerald-200 bg-emerald-50/40': row.is_paid }"
        >
          <div>
            <span class="font-medium tabular-nums text-slate-800">{{ row.time }}</span>
            <span class="ml-2 text-slate-700">{{ row.client_name }}</span>
            <p class="text-xs text-slate-500">
              {{ row.service_name }} ·
              {{ row.is_paid ? 'Cobrada' : (STATUS_LABELS[row.status] ?? row.status) }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <span v-if="row.is_paid" class="text-sm tabular-nums text-emerald-800">
              {{ money(row.total) }}
            </span>
            <NxButton
              v-else-if="auth.can('caja.cobrar')"
              variant="outline"
              size="sm"
              @click="charge(row.id)"
            >
              Cobrar
            </NxButton>
          </div>
        </article>
      </div>
    </template>

    <WalkInModal
      :open="walkInOpen"
      :my-resource-id="myResourceId"
      @close="walkInOpen = false"
      @saved="onWalkInSaved"
    />

    <CheckoutModal
      :appointment="toCheckout"
      @close="toCheckout = null"
      @done="onCobrado"
      @cancelled="onCancelada"
    />
  </section>
</template>
