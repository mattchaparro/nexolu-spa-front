<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useMoney } from '@/modules/cash/composables/useMoney'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxDatePicker, NxInput, NxSelect } from '@/ui'

import {
  useCompensation,
  useUpdateCompensation,
  type CompensationRow,
} from '../composables/usePayroll'

const { money } = useMoney()
const { notify } = useSystemAlert()

const { data, isLoading } = useCompensation()
const { mutateAsync: save, isPending: saving } = useUpdateCompensation()

const selectedId = ref<number | null>(null)

const team = computed<CompensationRow[]>(() => data.value?.resources ?? [])
const selected = computed(() => team.value.find((r) => r.id === selectedId.value) ?? null)

const mode = ref('commission')
const baseAmount = ref('')
const basePeriod = ref('month')
const baseUntil = ref<string | null>(null)
const startedOn = ref<string | null>(null)
const error = ref<string | null>(null)

watch(
  team,
  (list) => {
    if (selectedId.value === null && list.length) selectedId.value = list[0].id
  },
  { immediate: true },
)

watch(
  selected,
  (row) => {
    mode.value = row?.payroll_mode ?? 'commission'
    baseAmount.value = row?.base_amount ? String(row.base_amount) : ''
    basePeriod.value = row?.base_period ?? 'month'
    baseUntil.value = row?.base_until ?? null
    startedOn.value = row?.payroll_started_on ?? null
    error.value = null
  },
  { immediate: true },
)

const usesBase = computed(
  () => data.value?.modes.find((m) => m.name === mode.value)?.uses_base ?? false,
)

/** Cuánto vale un día con esta configuración: es lo que se prorratea. */
const dailyRate = computed(() => {
  const days = data.value?.base_periods.find((p) => p.name === basePeriod.value)?.days ?? 30
  return (Number(baseAmount.value) || 0) / days
})

const modeHelp = computed(() => {
  switch (mode.value) {
    case 'base_plus_commission':
      return 'Se le paga la base del período MÁS lo que haya generado en comisión.'
    case 'guaranteed_minimum':
      return 'Se le paga su comisión, y si no alcanza la base el negocio le completa hasta ese piso. Nunca se le recorta si produce más.'
    default:
      return 'Se le paga solo el porcentaje de lo que cobró. Es lo más común una vez tiene su clientela.'
  }
})

async function submit(): Promise<void> {
  if (!selected.value) return
  error.value = null

  try {
    await save({
      id: selected.value.id,
      payroll_mode: mode.value,
      base_amount: usesBase.value ? Number(baseAmount.value) || 0 : 0,
      base_period: basePeriod.value,
      base_until: usesBase.value ? baseUntil.value || null : null,
      payroll_started_on: startedOn.value || null,
    })
    notify(`Se actualizó cómo se le paga a ${selected.value.name}.`, 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar los cambios.')
  }
}

function modeLabel(name: string): string {
  return data.value?.modes.find((m) => m.name === name)?.label ?? name
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Cómo se le paga a cada una</h1>
      <p class="mt-1 max-w-2xl text-sm text-slate-500">
        Comisión, base o un mínimo garantizado. Cambiarlo acá no reescribe lo que ya se liquidó:
        cada comprobante conserva la configuración con la que se pagó.
      </p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <div v-else class="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside class="divide-y divide-slate-100 self-start rounded-lg border border-slate-200 bg-white">
        <button
          v-for="row in team"
          :key="row.id"
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
          :class="row.id === selectedId ? 'bg-slate-50' : ''"
          @click="selectedId = row.id"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-slate-800">{{ row.name }}</span>
            <span class="block truncate text-xs text-slate-500">
              {{ modeLabel(row.payroll_mode) }}
            </span>
          </span>
          <span v-if="!row.is_active" class="shrink-0 text-xs text-slate-400">inactiva</span>
        </button>
      </aside>

      <div v-if="selected" class="min-w-0 max-w-xl">
        <div class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="mb-4 text-lg font-semibold text-slate-800">{{ selected.name }}</h2>

          <div class="flex flex-col gap-4">
            <div>
              <NxSelect
                v-model="mode"
                :options="data?.modes ?? []"
                option-label="label"
                option-value="name"
                label="Forma de pago"
                :disabled="saving"
              />
              <p class="mt-1 text-xs text-slate-500">{{ modeHelp }}</p>
            </div>

            <template v-if="usesBase">
              <div class="grid gap-3 sm:grid-cols-2">
                <NxInput v-model="baseAmount" label="Base" inputmode="numeric" :disabled="saving" />
                <NxSelect
                  v-model="basePeriod"
                  :options="data?.base_periods ?? []"
                  option-label="label"
                  option-value="name"
                  label="Cada"
                  :disabled="saving"
                />
              </div>

              <p class="-mt-1 text-xs text-slate-500">
                Equivale a {{ money(dailyRate) }} por día. El período de liquidación es irregular
                —se paga cuando ella pide— así que la base se prorratea por los días que corran.
                Un mes son 30 días, para que febrero no pague más por día que enero.
              </p>

              <div>
                <NxDatePicker v-model="baseUntil" label="Base vigente hasta (opcional)" />
                <p class="mt-1 text-xs text-slate-500">
                  Para la base temporal: la que se da mientras arma clientela. Pasada esa fecha
                  queda solo a comisión, sin que nadie tenga que acordarse de quitarla.
                </p>
              </div>
            </template>

            <div>
              <NxDatePicker
                v-model="startedOn"
                label="Se le liquida desde"
                :disabled="saving"
              />
              <p class="mt-1 text-xs text-slate-500">
                Solo para la primera liquidación. Después, cada período arranca donde terminó el
                anterior y esta fecha deja de tener efecto.
              </p>
            </div>

            <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ error }}
            </p>

            <NxButton :loading="saving" @click="submit">Guardar</NxButton>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
