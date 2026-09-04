<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useAuthStore } from '@/stores/auth.store'
import { NxButton } from '@/ui'

import CheckoutModal from '@/modules/agenda/components/CheckoutModal.vue'
import {
  fetchAppointment,
  useAppointments,
  type Appointment,
} from '@/modules/agenda/composables/useAppointments'
import { useMoney } from '@/modules/cash/composables/useMoney'
import { toLocalDateIso } from '@/utils/toLocalDateIso'

import WalkInModal from '../components/WalkInModal.vue'
import WorkPhotoModal from '../components/WorkPhotoModal.vue'
import { useMyWork, type PendingService } from '../composables/useMyWork'

const auth = useAuthStore()
const queryClient = useQueryClient()
const { notify } = useSystemAlert()
const { money } = useMoney()

const { data, isLoading } = useMyWork()

const today = ref(toLocalDateIso())
const { data: appointments } = useAppointments(today)

const walkInOpen = ref(false)
const toCheckout = ref<Appointment | null>(null)
const toPhotograph = ref<PendingService | null>(null)

const myResourceId = computed(() => data.value?.resource?.id ?? null)

/**
 * Abre el cobro de un pendiente.
 *
 * La rejilla de HOY es sólo un atajo: casi siempre la cita está ahí y se abre
 * sin ir a la red. Pero los pendientes NO tienen límite hacia atrás —a alguien
 * se le olvidó registrar lo de ayer y lo hace hoy, que es el caso normal— y
 * una cita de ayer no está en la agenda de hoy. Antes eso contestaba "no
 * encontramos esa cita" sobre algo que la misma pantalla acababa de listar.
 */
async function charge(appointmentId: number): Promise<void> {
  const enLaRejilla = appointments.value?.find((a) => a.id === appointmentId)

  if (enLaRejilla) {
    toCheckout.value = enLaRejilla

    return
  }

  try {
    toCheckout.value = await fetchAppointment(queryClient, appointmentId)
  } catch {
    notify('No pudimos abrir esa cita. Recarga la página.', 'warn')
  }
}

/*
 * Los manejadores de dos sentencias van en FUNCIONES CON NOMBRE, no inline.
 *
 * Inline se escriben en una línea con punto y coma, y Prettier los parte en
 * dos sin él — que el compilador de plantillas de Vue rechaza. Eso ya costó
 * dos pantallas rotas en producción (ver el postmortem en TESTING.md), y una
 * regla que depende de que nadie corra el formateador no es una regla.
 */
function onWalkInSaved(): void {
  walkInOpen.value = false
  notify('Servicio registrado.', 'success')
}

function onCharged(): void {
  toCheckout.value = null
  notify('Cobrado. La comisión quedó registrada.', 'success')
}

function onCancelled(): void {
  toCheckout.value = null
  notify('Cita cancelada.', 'success')
}

/** Hace cuánto quedó listo el trabajo, en palabras. */
function endedLabel(pending: PendingService): string {
  if (!pending.ended_at) return ''

  const minutos = Math.round((Date.now() - new Date(pending.ended_at).getTime()) / 60000)

  if (minutos < 60) return `hace ${minutos} min`

  const horas = Math.floor(minutos / 60)

  return `hace ${horas} h`
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
      <NxButton v-if="auth.can('citas.crear')" @click="walkInOpen = true">
        Servicio sin cita
      </NxButton>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p v-else-if="!data?.resource" class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600">
      {{ data?.message ?? 'Tu usuario no está asociado a nadie de la agenda.' }}
    </p>

    <template v-else>
      <!-- Lo que atendió pero no cobró: es lo primero que tiene que resolver
           antes de irse, no un dato más. -->
      <div
        v-if="data.pending_checkout.length"
        class="mb-6 rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3"
      >
        <p class="text-sm font-medium text-amber-900">
          {{ data.pending_checkout.length }} servicio(s) sin cobrar
        </p>
        <div class="mt-2 flex flex-col gap-2">
          <div
            v-for="pending in data.pending_checkout"
            :key="pending.id"
            class="flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900"
          >
            <span>
              <span class="tabular-nums">{{ pending.label }}</span>
              · {{ pending.client_name }} · {{ pending.service_name }}

              <!--
                "Terminó" y no "pendiente": mientras la clienta sigue en la
                silla no hay nada atrasado, y pintarlo igual sería mentir
                sobre el atraso. El servidor ya resolvió cuál es cuál.
              -->
              <span v-if="pending.is_done" class="text-xs text-amber-700">
                · terminó {{ endedLabel(pending) }}
              </span>
            </span>

            <div class="flex gap-2">
              <NxButton
                v-if="pending.needs_photo"
                variant="outline"
                size="sm"
                @click="toPhotograph = pending"
              >
                Subir foto
              </NxButton>
              <NxButton
                v-if="auth.can('caja.cobrar')"
                variant="outline"
                size="sm"
                @click="charge(pending.id)"
              >
                Cobrar
              </NxButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Lo que gana ella, no la facturación del negocio: es lo que una
           del equipo viene a mirar. -->
      <div class="mb-6 grid gap-3 sm:grid-cols-3">
        <article
          v-for="period in [
            { key: 'today', label: 'Hoy', data: data.today },
            { key: 'week', label: 'Esta semana', data: data.week },
            { key: 'month', label: 'Este mes', data: data.month },
          ]"
          :key="period.key"
          class="rounded-lg border border-slate-200 bg-white p-4"
        >
          <p class="text-xs uppercase tracking-wide text-slate-400">{{ period.label }}</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ money(period.data.commission) }}
          </p>
          <p class="text-xs text-slate-500">
            {{ period.data.services }} servicio(s) · {{ money(period.data.charged) }} cobrado
          </p>
        </article>
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

    <WorkPhotoModal :pending="toPhotograph" @close="toPhotograph = null" />

    <WalkInModal
      :open="walkInOpen"
      :my-resource-id="myResourceId"
      @close="walkInOpen = false"
      @saved="onWalkInSaved"
    />

    <CheckoutModal
      :appointment="toCheckout"
      @close="toCheckout = null"
      @done="onCharged"
      @cancelled="onCancelled"
    />
  </section>
</template>
