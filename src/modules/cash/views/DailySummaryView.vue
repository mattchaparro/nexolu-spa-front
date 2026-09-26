<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useAuthStore } from '@/stores/auth.store'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxDatePicker } from '@/ui'

import LocationPicker from '@/modules/settings/components/LocationPicker.vue'
import { toLocalDateIso } from '@/utils/toLocalDateIso'

import CorrectCheckoutModal from '../components/CorrectCheckoutModal.vue'
import {
  useDailySummary,
  useDeleteCharged,
  useUndoCheckout,
  type DailySummaryLine,
} from '../composables/useCash'
import { useMoney } from '../composables/useMoney'

const auth = useAuthStore()
const { money } = useMoney()

const date = ref(toLocalDateIso())

/*
 * Sin `requerido`: el resumen no se cuadra contra un cajón, responde "cómo nos
 * fue hoy". Para el dueño de dos locales esa pregunta es de los dos, así que
 * "todas" es el default correcto -- al revés que en el cierre.
 */
const locationId = ref<number | null>(null)

const { data, isLoading } = useDailySummary(date, locationId)

/*
 * Corregir lo cobrado. Solo con el permiso: cambiar un cobro ya hecho mueve
 * la caja y la comisión de alguien, y no le avisa a nadie.
 */
const puedeCorregir = computed(() => auth.can('caja.corregir'))
const { notify } = useSystemAlert()

/** Las líneas de la cita que se está corrigiendo (una cita puede tener varias). */
const corrigiendo = ref<DailySummaryLine[]>([])

function corregir(line: DailySummaryLine): void {
  corrigiendo.value = (data.value?.lines ?? []).filter(
    (l) => l.appointment_id === line.appointment_id,
  )
}

function onCorregido(): void {
  corrigiendo.value = []
  notify('Cobro corregido.', 'success')
}

const { mutateAsync: deshacer } = useUndoCheckout()
const { mutateAsync: eliminar } = useDeleteCharged()
const trabajando = ref<number | null>(null)

async function deshacerCobro(line: DailySummaryLine): Promise<void> {
  if (
    !window.confirm(
      `¿Deshacer el cobro de ${line.client_name ?? 'esta cita'}? Vuelve a la agenda sin cobrar y sale de la caja de este día.`,
    )
  ) {
    return
  }

  trabajando.value = line.appointment_id
  try {
    await deshacer(line.appointment_id)
    notify('Cobro deshecho. La cita quedó en la agenda sin cobrar.', 'success')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos deshacer el cobro.'), 'error')
  } finally {
    trabajando.value = null
  }
}

async function eliminarServicio(line: DailySummaryLine): Promise<void> {
  const motivo = window.prompt(
    `¿Eliminar el servicio de ${line.client_name ?? 'esta cita'}? Sale de la caja, de la comisión y de la agenda, y no se le avisa a nadie.\n\nMotivo (opcional):`,
    'Subido de más',
  )

  if (motivo === null) {
    return
  }

  trabajando.value = line.appointment_id
  try {
    await eliminar({ appointmentId: line.appointment_id, reason: motivo.trim() || undefined })
    notify('Servicio eliminado.', 'success')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos eliminarlo.'), 'error')
  } finally {
    trabajando.value = null
  }
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Resumen del día</h1>
        <p class="mt-1 text-sm text-slate-500">{{ auth.business?.name }}</p>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <LocationPicker v-model="locationId" label="Sede" />
        <div class="w-44">
          <NxDatePicker v-model="date" label="Día" />
        </div>
      </div>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <template v-else-if="data">
      <!-- Lo que falta cobrar va arriba y en ámbar: es la acción pendiente
           más común al cerrar la jornada, no un dato más. -->
      <div
        v-if="data.appointments.pending_checkout > 0"
        class="mb-6 rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <p class="font-medium">{{ data.appointments.pending_checkout }} cita(s) sin cobrar</p>
        <p class="mt-0.5">
          <RouterLink :to="{ name: 'agenda' }" class="underline">Ir a la agenda</RouterLink>
        </p>
      </div>

      <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Entró</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ money(data.totals.total_charged) }}
          </p>
          <p class="text-xs text-slate-500">{{ data.totals.appointments }} cita(s) cobrada(s)</p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">En comisiones</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ money(data.totals.total_commissions) }}
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Gastos</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ money(data.totals.total_expenses) }}
          </p>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <p class="text-xs uppercase tracking-wide text-slate-400">Citas</p>
          <p class="mt-1 text-2xl font-semibold tabular-nums text-slate-800">
            {{ data.appointments.total }}
          </p>
          <p class="text-xs text-slate-500">
            {{ data.appointments.completed }} atendidas
            <span v-if="data.appointments.no_show" class="text-red-600">
              · {{ data.appointments.no_show }} no asistió
            </span>
            <span v-if="data.appointments.cancelled" class="text-slate-400">
              · {{ data.appointments.cancelled }} canceladas
            </span>
          </p>
        </article>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-700">Por persona</h2>

          <p v-if="!data.by_resource.length" class="text-sm text-slate-500">Sin citas este día.</p>

          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th class="pb-2 font-medium">Quién</th>
                  <th class="pb-2 text-right font-medium">Citas</th>
                  <th class="pb-2 text-right font-medium">Cobrado</th>
                  <th class="pb-2 text-right font-medium">Comisión</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="row in data.by_resource" :key="row.name">
                  <td class="py-2 text-slate-800">{{ row.name }}</td>
                  <td class="py-2 text-right tabular-nums text-slate-600">
                    {{ row.appointments }}
                  </td>
                  <td class="py-2 text-right tabular-nums text-slate-600">
                    {{ money(row.charged) }}
                  </td>
                  <td class="py-2 text-right tabular-nums font-medium text-slate-800">
                    {{ money(row.commission) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-700">Cómo entró</h2>

          <p v-if="!data.totals.payment_breakdown.length" class="text-sm text-slate-500">
            Sin cobros este día.
          </p>

          <p
            v-for="row in data.totals.payment_breakdown"
            :key="row.label"
            class="flex items-center justify-between border-b border-slate-50 py-1.5 text-sm last:border-0"
          >
            <span class="text-slate-700">
              {{ row.label }}
              <span v-if="!row.counts_as_cash" class="ml-1 text-xs text-slate-400"
                >no es efectivo</span
              >
            </span>
            <span class="tabular-nums text-slate-800">{{ money(row.total) }}</span>
          </p>

          <p class="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
            <span class="font-medium text-slate-700">Debe haber en caja</span>
            <span class="font-semibold tabular-nums text-slate-900">
              {{ money(data.totals.expected_cash) }}
            </span>
          </p>
        </article>
      </div>

      <!-- Cada servicio cobrado, uno por uno. Es donde se encuentra lo que se
           subió de más o con el valor equivocado, y donde se corrige. -->
      <article class="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 class="mb-3 text-sm font-medium text-slate-700">
          Servicios cobrados
          <span class="ml-1 font-normal text-slate-400">{{ data.lines.length }}</span>
        </h2>

        <p v-if="!data.lines.length" class="text-sm text-slate-500">Nada cobrado este día.</p>

        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="pb-2 font-medium">Hora</th>
                <th class="pb-2 font-medium">Clienta</th>
                <th class="pb-2 font-medium">Servicio</th>
                <th class="pb-2 font-medium">Quién</th>
                <th class="pb-2 text-right font-medium">Cobrado</th>
                <th class="pb-2 font-medium">Medio</th>
                <th class="pb-2 text-right font-medium">Comisión</th>
                <th v-if="puedeCorregir" class="pb-2" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="l in data.lines" :key="l.item_id" class="align-top">
                <td class="py-2 tabular-nums text-slate-500">{{ l.charged_at }}</td>
                <td class="py-2 text-slate-800">{{ l.client_name ?? 'Sin nombre' }}</td>
                <td class="py-2 text-slate-700">
                  {{ l.service_name }}
                  <span v-if="l.discount_reason" class="block text-xs text-amber-700">
                    {{ l.discount_reason }}
                  </span>
                </td>
                <td class="py-2 text-slate-700">{{ l.resource_name }}</td>
                <td class="py-2 text-right tabular-nums text-slate-800">
                  {{ money(l.charged) }}
                  <span
                    v-if="Math.abs(l.charged - l.price) > 0.5"
                    class="block text-xs text-slate-400"
                  >
                    carta {{ money(l.price) }}
                  </span>
                </td>
                <td class="py-2 text-slate-700">{{ l.payment_method }}</td>
                <td class="py-2 text-right tabular-nums font-medium text-slate-800">
                  {{ money(l.commission) }}
                </td>
                <td v-if="puedeCorregir" class="py-2 pl-3 text-right">
                  <span v-if="l.settled" class="text-xs text-slate-400">Pagada en nómina</span>
                  <div v-else class="flex justify-end gap-1 whitespace-nowrap">
                    <button
                      type="button"
                      class="rounded px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
                      :disabled="trabajando === l.appointment_id"
                      @click="corregir(l)"
                    >
                      Corregir
                    </button>
                    <button
                      type="button"
                      class="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      :disabled="trabajando === l.appointment_id"
                      @click="deshacerCobro(l)"
                    >
                      Deshacer cobro
                    </button>
                    <button
                      type="button"
                      class="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      :disabled="trabajando === l.appointment_id"
                      @click="eliminarServicio(l)"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </template>

    <CorrectCheckoutModal :lines="corrigiendo" @close="corrigiendo = []" @saved="onCorregido" />
  </section>
</template>
