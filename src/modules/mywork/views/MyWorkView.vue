<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useAuthStore } from '@/stores/auth.store'
import { NxButton } from '@/ui'

import CheckoutModal from '@/modules/agenda/components/CheckoutModal.vue'
import { useAppointments, type Appointment } from '@/modules/agenda/composables/useAppointments'
import { useMoney } from '@/modules/cash/composables/useMoney'
import { toLocalDateIso } from '@/utils/toLocalDateIso'

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

function charge(appointmentId: number): void {
  const full = appointments.value?.find((a) => a.id === appointmentId)

  if (full) {
    toCheckout.value = full
  } else {
    notify('No encontramos esa cita. Recarga la página.', 'warn')
  }
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

    <p
      v-else-if="!data?.resource"
      class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600"
    >
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

      <p v-if="!data.agenda.length" class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600">
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
      @saved="walkInOpen = false; notify('Servicio registrado.', 'success')"
    />

    <CheckoutModal
      :appointment="toCheckout"
      @close="toCheckout = null"
      @done="toCheckout = null; notify('Cobrado. La comisión quedó registrada.', 'success')"
      @cancelled="toCheckout = null; notify('Cita cancelada.', 'success')"
    />
  </section>
</template>
