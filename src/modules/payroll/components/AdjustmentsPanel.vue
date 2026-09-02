<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useMoney } from '@/modules/cash/composables/useMoney'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxDatePicker, NxInput, NxModal, NxSelect } from '@/ui'
import { toLocalDateIso } from '@/utils/toLocalDateIso'

import {
  useAdjustments,
  useDeleteAdjustment,
  useStoreAdjustment,
  type PreviewAdjustment,
} from '../composables/usePayroll'

const props = defineProps<{
  resourceId: number
  resourceName: string
  /** Los que entran en la liquidación que se está mirando. */
  adjustments: PreviewAdjustment[]
}>()

const { money } = useMoney()
const { notify } = useSystemAlert()

const { data: catalogData } = useAdjustments(toRef(props, 'resourceId'))
const { mutateAsync: store, isPending: saving } = useStoreAdjustment()
const { mutateAsync: remove } = useDeleteAdjustment()

const open = ref(false)
const today = toLocalDateIso()
const date = ref(today)
const category = ref('anticipo')
const amount = ref('')
const description = ref('')
const error = ref<string | null>(null)

const categories = computed(() =>
  (catalogData.value?.catalog ?? []).map((c) => ({
    ...c,
    // El signo va en la etiqueta: es el dato que importa al elegir.
    display: `${c.kind === 'deduction' ? '−' : '+'} ${c.label}`,
  })),
)

const chosen = computed(() => categories.value.find((c) => c.name === category.value) ?? null)

watch(open, (isOpen) => {
  if (!isOpen) return
  date.value = today
  category.value = 'anticipo'
  amount.value = ''
  description.value = ''
  error.value = null
})

const canSubmit = computed(() => Number(amount.value) > 0 && !saving.value)

async function submit(): Promise<void> {
  error.value = null

  try {
    await store({
      resource_id: props.resourceId,
      date: date.value,
      category: category.value,
      amount: Number(amount.value),
      description: description.value.trim() || null,
    })
    open.value = false
    notify('Movimiento registrado.', 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos registrar el movimiento.')
  }
}

async function destroy(row: PreviewAdjustment): Promise<void> {
  if (!window.confirm(`¿Eliminar ${money(row.amount)} de ${props.resourceName}?`)) return

  try {
    await remove(row.id)
    notify('Movimiento eliminado.', 'success')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos eliminarlo.'), 'error')
  }
}
</script>

<template>
  <div class="rounded-lg border border-slate-200 bg-white">
    <div class="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
      <p class="text-sm font-medium text-slate-800">Anticipos, descuentos y bonos</p>
      <NxButton variant="ghost" size="sm" @click="open = true">Registrar</NxButton>
    </div>

    <p v-if="!adjustments.length" class="px-4 py-6 text-center text-sm text-slate-500">
      Nada pendiente. Lo que registres acá se descuenta —o se suma— en la próxima liquidación.
    </p>

    <ul v-else class="divide-y divide-slate-50">
      <li v-for="row in adjustments" :key="row.id" class="flex items-start gap-3 px-4 py-3">
        <span class="min-w-0 flex-1">
          <span class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-slate-800">{{ row.category_label }}</span>
            <span class="text-xs text-slate-400">{{ row.date }}</span>
            <!-- Un anticipo digitado tarde, con fecha anterior al período que
                 ya se liquidó, entra igual. Se marca para que quien paga
                 entienda de dónde salió. -->
            <span
              v-if="row.outside_period"
              class="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900"
            >
              de antes del período
            </span>
          </span>
          <span v-if="row.description" class="mt-0.5 block text-xs text-slate-500">
            {{ row.description }}
          </span>
        </span>

        <span
          class="shrink-0 text-sm font-medium tabular-nums"
          :class="row.kind === 'deduction' ? 'text-red-600' : 'text-emerald-700'"
        >
          {{ row.kind === 'deduction' ? '−' : '+' }}{{ money(row.amount) }}
        </span>

        <button
          type="button"
          class="shrink-0 text-xs text-slate-400 hover:text-red-600"
          @click="destroy(row)"
        >
          Eliminar
        </button>
      </li>
    </ul>

    <NxModal
      :model-value="open"
      :title="`Registrar movimiento de ${resourceName}`"
      @update:model-value="open = $event"
    >
      <div class="flex flex-col gap-4">
        <NxSelect
          v-model="category"
          :options="categories"
          option-label="display"
          option-value="name"
          label="Tipo"
          :disabled="saving"
        />

        <p v-if="chosen" class="-mt-2 text-xs text-slate-500">{{ chosen.help }}</p>

        <div class="grid gap-3 sm:grid-cols-2">
          <NxDatePicker v-model="date" label="Fecha" />
          <NxInput v-model="amount" label="Monto" inputmode="numeric" :disabled="saving" />
        </div>

        <NxInput v-model="description" label="Descripción (opcional)" :disabled="saving" />

        <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <div class="flex justify-end gap-2">
          <NxButton variant="secondary" :disabled="saving" @click="open = false">Cancelar</NxButton>
          <NxButton :loading="saving" :disabled="!canSubmit" @click="submit">Registrar</NxButton>
        </div>
      </div>
    </NxModal>
  </div>
</template>
