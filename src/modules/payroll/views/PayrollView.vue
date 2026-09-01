<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useMoney } from '@/modules/cash/composables/useMoney'
import { usePaymentMethods } from '@/composables/usePaymentMethods'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxModal, NxSelect, NxTextarea } from '@/ui'

import LocationPicker from '@/modules/settings/components/LocationPicker.vue'

import AdjustmentsPanel from '../components/AdjustmentsPanel.vue'
import {
  usePayrollPreview,
  usePendingPayroll,
  useSettlePayroll,
  type PendingRow,
} from '../composables/usePayroll'

const { money, signed } = useMoney()
const { notify } = useSystemAlert()

// Sin `requerido`: la nómina no se cuadra contra un cajón. "Todas" es una
// respuesta legítima y es la que quiere quien paga a todo el equipo.
const locationId = ref<number | null>(null)

const { data: pending, isLoading } = usePendingPayroll(locationId)
const selectedId = ref<number | null>(null)
const {
  data: preview,
  isLoading: loadingPreview,
  error: previewError,
} = usePayrollPreview(selectedId)
const { data: paymentMethods } = usePaymentMethods()
const { mutateAsync: settle, isPending: settling } = useSettlePayroll()

const rows = computed<PendingRow[]>(() => pending.value?.resources ?? [])

watch(
  rows,
  (list) => {
    // Tras liquidar, la elegida desaparece de la lista. Sin reelegir, el
    // detalle queda mostrando "ya se liquidó hasta" para alguien que ya no
    // está y parece un error en vez de un pago hecho.
    const stillThere = list.some((r) => r.resource_id === selectedId.value)

    if (!stillThere) {
      selectedId.value = list[0]?.resource_id ?? null
    }
  },
  { immediate: true },
)

const confirming = ref(false)
const paymentMethodId = ref<number | null>(null)
const notes = ref('')
const error = ref<string | null>(null)

const totalPending = computed(() => rows.value.reduce((sum, r) => sum + r.net_total, 0))

function openConfirm(): void {
  error.value = null
  notes.value = ''
  paymentMethodId.value = paymentMethods.value?.[0]?.id ?? null
  confirming.value = true
}

async function confirm(): Promise<void> {
  if (!preview.value) return
  error.value = null

  try {
    await settle({
      resourceId: preview.value.resource.id,
      payment_method_id: paymentMethodId.value,
      notes: notes.value || null,
    })
    confirming.value = false
    notify(`Liquidación de ${preview.value.resource.name} registrada.`, 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos registrar la liquidación.')
  }
}

function shortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  })
}

const previewMessage = computed(() =>
  previewError.value ? extractErrorMessage(previewError.value, 'No hay nada que liquidar.') : null,
)
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Nómina</h1>
        <p class="mt-1 max-w-2xl text-sm text-slate-500">
          Lo que le debes a cada persona del equipo desde su última liquidación. El período arranca
          solo donde terminó el anterior, así que no hay forma de pagar dos veces lo mismo.
        </p>
      </div>

      <LocationPicker v-model="locationId" label="Sede" />

      <div v-if="rows.length" class="text-right">
        <p class="text-xs uppercase tracking-wide text-slate-400">Total pendiente</p>
        <p class="text-2xl font-semibold text-slate-800">{{ money(totalPending) }}</p>
      </div>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p
      v-else-if="!rows.length"
      class="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500"
    >
      No hay nada pendiente por liquidar.
    </p>

    <div v-else class="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <!-- Quién tiene qué pendiente -->
      <aside
        class="divide-y divide-slate-100 self-start rounded-lg border border-slate-200 bg-white"
      >
        <button
          v-for="row in rows"
          :key="row.resource_id"
          type="button"
          class="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
          :class="row.resource_id === selectedId ? 'bg-slate-50' : ''"
          @click="selectedId = row.resource_id"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-slate-800">{{ row.name }}</span>
            <span class="block text-xs text-slate-500">
              {{ shortDate(row.period_start) }} – {{ shortDate(row.period_end) }} ·
              {{ row.services_count }} servicio(s)
            </span>
          </span>
          <span
            class="shrink-0 text-sm font-medium"
            :class="row.net_total < 0 ? 'text-red-600' : 'text-slate-800'"
          >
            {{ money(row.net_total) }}
          </span>
        </button>
      </aside>

      <!-- El detalle -->
      <div class="min-w-0">
        <p v-if="loadingPreview" class="text-sm text-slate-500">Cargando…</p>

        <p
          v-else-if="previewMessage"
          class="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {{ previewMessage }}
        </p>

        <template v-else-if="preview">
          <!-- La cuenta -->
          <div class="mb-5 rounded-lg border border-slate-200 bg-white p-5">
            <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 class="text-lg font-semibold text-slate-800">{{ preview.resource.name }}</h2>
              <p class="text-xs text-slate-500">
                {{ preview.period_start }} a {{ preview.period_end }} · {{ preview.days }} día(s)
              </p>
            </div>

            <dl class="space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-slate-600">
                  Comisión · {{ preview.services_count }} servicio(s) por
                  {{ money(preview.charged_total) }}
                </dt>
                <dd class="font-medium text-slate-800">{{ money(preview.commission_total) }}</dd>
              </div>

              <div v-if="preview.base_total > 0" class="flex justify-between">
                <dt class="text-slate-600">
                  <!-- En mínimo garantizado la base no se suma: es lo que se
                       completó para llegar al piso. -->
                  {{ preview.topped_up > 0 ? 'Complemento hasta el mínimo' : 'Base del período' }}
                </dt>
                <dd class="font-medium text-slate-800">{{ money(preview.base_total) }}</dd>
              </div>

              <div v-if="preview.bonus_total > 0" class="flex justify-between">
                <dt class="text-slate-600">Bonos</dt>
                <dd class="font-medium text-emerald-700">{{ signed(preview.bonus_total) }}</dd>
              </div>

              <div v-if="preview.deduction_total > 0" class="flex justify-between">
                <dt class="text-slate-600">Anticipos y descuentos</dt>
                <dd class="font-medium text-red-600">{{ signed(-preview.deduction_total) }}</dd>
              </div>

              <div class="flex justify-between border-t border-slate-100 pt-3">
                <dt class="font-medium text-slate-800">A pagar</dt>
                <dd
                  class="text-xl font-semibold"
                  :class="preview.net_total < 0 ? 'text-red-600' : 'text-slate-900'"
                >
                  {{ money(preview.net_total) }}
                </dd>
              </div>
            </dl>

            <p
              v-if="preview.net_total < 0"
              class="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              Debe más de lo que produjo en este período. Si liquidas ahora queda en cero y no sale
              plata; el saldo no se arrastra solo.
            </p>

            <NxButton class="mt-4" :disabled="settling" @click="openConfirm">
              Liquidar y pagar
            </NxButton>
          </div>

          <!-- Cómo trabajó en el período: garantías y calificaciones juntas.
               Responden la misma pregunta desde dos lados -- cuántas veces
               hubo que rehacer su trabajo, y qué opinaron los que sí quedaron
               conformes. Mirar una sin la otra lleva a conclusiones injustas
               en las dos direcciones. -->
          <div
            v-if="preview.warranties.count > 0 || preview.ratings.count > 0"
            class="mt-5 rounded-lg border border-slate-200 bg-white p-4"
          >
            <h3 class="mb-3 text-sm font-medium text-slate-700">Cómo le fue en el período</h3>

            <div class="grid gap-4 sm:grid-cols-2">
              <div v-if="preview.ratings.count > 0">
                <p class="text-xs uppercase tracking-wide text-slate-400">Calificación</p>
                <p class="mt-1 text-2xl font-semibold text-slate-800">
                  {{ preview.ratings.staff_average ?? '—' }}
                  <span class="text-sm font-normal text-slate-500">
                    / 5 · {{ preview.ratings.count }} respuesta(s)
                  </span>
                </p>
                <p
                  v-for="(c, i) in preview.ratings.comments"
                  :key="i"
                  class="mt-1 text-xs text-slate-600"
                >
                  “{{ c.comment }}”
                </p>
              </div>

              <div v-if="preview.warranties.count > 0">
                <p class="text-xs uppercase tracking-wide text-slate-400">Garantías recibidas</p>
                <p class="mt-1 text-2xl font-semibold text-amber-700">
                  {{ preview.warranties.count }}
                </p>
                <p
                  v-for="w in preview.warranties.items"
                  :key="w.appointment_item_id"
                  class="mt-1 text-xs text-slate-600"
                >
                  {{ w.date }} · {{ w.service_name }}
                  <span v-if="w.done_by" class="text-slate-400">· la rehizo {{ w.done_by }}</span>
                  <span v-if="w.note" class="block text-slate-500">{{ w.note }}</span>
                </p>
                <!-- No se descuenta solo: una multa automática por un número
                     sin contexto convierte un esmalte corrido en un descuento
                     de nómina, y eso se pelea. -->
                <p class="mt-2 text-xs text-slate-500">
                  No se descuentan solas. Si decides una multa, ponla como descuento acá abajo y
                  queda registrada.
                </p>
              </div>
            </div>
          </div>

          <!-- Anticipos, descuentos y bonos -->
          <AdjustmentsPanel
            :resource-id="preview.resource.id"
            :resource-name="preview.resource.name"
            :adjustments="preview.adjustments"
          />

          <!-- Servicio por servicio -->
          <div class="mt-5 rounded-lg border border-slate-200 bg-white">
            <p class="border-b border-slate-100 px-4 py-2.5 text-sm font-medium text-slate-800">
              Servicios del período
            </p>

            <p v-if="!preview.items.length" class="px-4 py-6 text-center text-sm text-slate-500">
              Todavía no ha cobrado nada en este período.
            </p>

            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th class="px-4 py-2 font-medium">Fecha</th>
                    <th class="px-4 py-2 font-medium">Servicio</th>
                    <th class="px-4 py-2 font-medium">Cliente</th>
                    <th class="px-4 py-2 text-right font-medium">Cobrado</th>
                    <th class="px-4 py-2 text-right font-medium">%</th>
                    <th class="px-4 py-2 text-right font-medium">Comisión</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                  <tr v-for="(item, i) in preview.items" :key="i">
                    <td class="whitespace-nowrap px-4 py-2 text-slate-500">
                      {{ shortDate(item.charged_at) }}
                    </td>
                    <td class="px-4 py-2 text-slate-800">{{ item.service_name }}</td>
                    <td class="px-4 py-2 text-slate-500">{{ item.client_name ?? '—' }}</td>
                    <td class="whitespace-nowrap px-4 py-2 text-right text-slate-600">
                      {{ money(item.charged) }}
                    </td>
                    <td class="px-4 py-2 text-right text-slate-500">
                      {{
                        item.commission_rate === null
                          ? '—'
                          : `${Math.round(item.commission_rate * 100)}%`
                      }}
                    </td>
                    <td class="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-800">
                      {{ money(item.commission_amount) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Confirmar el pago -->
    <NxModal
      :model-value="confirming"
      title="Liquidar y pagar"
      @update:model-value="confirming = $event"
    >
      <div v-if="preview" class="space-y-4">
        <p class="text-sm text-slate-600">
          Le vas a pagar
          <span class="font-semibold text-slate-900">{{ money(preview.net_total) }}</span>
          a {{ preview.resource.name }} por el período {{ preview.period_start }} a
          {{ preview.period_end }}.
        </p>

        <p class="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Queda registrado como gasto de nómina. Si pagas en efectivo, sale de la caja del día y el
          cierre lo va a mostrar.
        </p>

        <NxSelect
          v-model="paymentMethodId"
          label="Con qué le pagas"
          :options="paymentMethods ?? []"
          option-label="name"
          option-value="id"
          placeholder="Elige un medio"
        />

        <NxTextarea v-model="notes" label="Nota (opcional)" :rows="2" />

        <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>
      </div>

      <template #footer>
        <NxButton variant="secondary" :disabled="settling" @click="confirming = false">
          Cancelar
        </NxButton>
        <NxButton :loading="settling" @click="confirm">Confirmar pago</NxButton>
      </template>
    </NxModal>
  </section>
</template>
