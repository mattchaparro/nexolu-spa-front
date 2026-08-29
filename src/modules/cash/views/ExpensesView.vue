<script setup lang="ts">
import { computed, ref } from 'vue'

import { usePaymentMethods } from '@/composables/usePaymentMethods'
import { useSystemAlert } from '@/composables/useSystemAlert'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxDatePicker, NxInput, NxModal, NxSelect } from '@/ui'

import {
  useDeleteExpense,
  useExpenseTypes,
  useExpenses,
  useSaveExpense,
  type ExpenseRow,
} from '../composables/useCash'
import { useMoney } from '../composables/useMoney'

const { notify } = useSystemAlert()
const { money } = useMoney()

const today = new Date().toISOString().slice(0, 10)
const from = ref(today.slice(0, 8) + '01')
const to = ref(today)

const { data, isLoading } = useExpenses(from, to)
const { data: types } = useExpenseTypes()
const { mutateAsync: save, isPending: saving } = useSaveExpense()
const { mutateAsync: remove } = useDeleteExpense()

const { data: methods } = usePaymentMethods()

// El alcance clasifica el gasto; lo que descuenta la caja es el medio de pago.
// Son dos preguntas distintas: el arriendo no es gasto de operar el martes,
// pero si lo pagaste en efectivo esos billetes salieron del cajón igual.
const SCOPES = [
  { value: 'operacional', label: 'Operacional — gasto de la jornada' },
  { value: 'administrativo', label: 'Administrativo — arriendo, nómina, impuestos' },
]

const open = ref(false)
const editing = ref<ExpenseRow | null>(null)
const date = ref(today)
const description = ref('')
const value = ref('')
const scope = ref('operacional')
const typeId = ref<number | null>(null)
const methodId = ref<number | null>(null)
const receipt = ref<File | null>(null)
const error = ref<string | null>(null)

function create(): void {
  editing.value = null
  date.value = today
  description.value = ''
  value.value = ''
  scope.value = 'operacional'
  typeId.value = null
  methodId.value = methods.value?.[0]?.id ?? null
  receipt.value = null
  error.value = null
  open.value = true
}

function edit(expense: ExpenseRow): void {
  editing.value = expense
  date.value = expense.date
  description.value = expense.description
  value.value = String(expense.value)
  scope.value = expense.scope
  typeId.value = expense.expense_type_id
  methodId.value = expense.payment_method_id
  receipt.value = null
  error.value = null
  open.value = true
}

const canSubmit = computed(
  () => description.value.trim().length > 1 && Number(value.value) > 0 && !saving.value,
)

async function submit(): Promise<void> {
  error.value = null

  try {
    await save({
      id: editing.value?.id,
      payload: {
        date: date.value,
        description: description.value.trim(),
        value: Number(value.value),
        scope: scope.value,
        expense_type_id: typeId.value,
        payment_method_id: methodId.value,
      },
      receipt: receipt.value,
    })
    open.value = false
    notify('Gasto guardado.', 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar el gasto.')
  }
}

async function destroy(expense: ExpenseRow): Promise<void> {
  if (!window.confirm(`¿Eliminar "${expense.description}"?`)) return
  await remove(expense.id)
  notify('Gasto eliminado.', 'success')
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Gastos</h1>
        <p class="mt-1 text-sm text-slate-500">Lo que sale, por fecha contable.</p>
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <div class="w-40"><NxDatePicker v-model="from" label="Desde" /></div>
        <div class="w-40"><NxDatePicker v-model="to" label="Hasta" /></div>
        <NxButton @click="create">Nuevo gasto</NxButton>
      </div>
    </header>

    <div v-if="data" class="mb-4 grid gap-3 sm:grid-cols-3">
      <article class="rounded-lg border border-slate-200 bg-white p-3">
        <p class="text-xs uppercase tracking-wide text-slate-400">Operacional</p>
        <p class="mt-1 text-lg font-semibold tabular-nums text-slate-800">
          {{ money(data.totals.operacional) }}
        </p>
        <p class="text-xs text-slate-500">Gasto de la jornada</p>
      </article>

      <article class="rounded-lg border border-slate-200 bg-white p-3">
        <p class="text-xs uppercase tracking-wide text-slate-400">Administrativo</p>
        <p class="mt-1 text-lg font-semibold tabular-nums text-slate-800">
          {{ money(data.totals.administrativo) }}
        </p>
        <p class="text-xs text-slate-500">Arriendo, nómina, impuestos</p>
      </article>

      <article class="rounded-lg border border-slate-200 bg-white p-3">
        <p class="text-xs uppercase tracking-wide text-slate-400">Total</p>
        <p class="mt-1 text-lg font-semibold tabular-nums text-slate-800">
          {{ money(data.totals.total) }}
        </p>
      </article>
    </div>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p v-else-if="!data?.data.length" class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600">
      Sin gastos en este rango.
    </p>

    <div v-else class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table class="w-full min-w-[42rem] text-sm">
        <thead class="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th class="px-4 py-3 font-medium">Fecha</th>
            <th class="px-4 py-3 font-medium">Descripción</th>
            <th class="px-4 py-3 font-medium">Alcance</th>
            <th class="px-4 py-3 text-right font-medium">Valor</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr v-for="expense in data.data" :key="expense.id">
            <td class="px-4 py-3 tabular-nums text-slate-600">{{ expense.date }}</td>
            <td class="px-4 py-3 text-slate-800">
              {{ expense.description }}
              <span v-if="expense.type" class="ml-1 text-xs text-slate-400">{{ expense.type }}</span>
              <a
                v-if="expense.receipt_url"
                :href="expense.receipt_url"
                target="_blank"
                rel="noopener"
                class="ml-2 text-xs text-indigo-600 underline"
              >
                recibo
              </a>
            </td>
            <td class="px-4 py-3">
              <span
                class="rounded px-2 py-0.5 text-xs"
                :class="
                  expense.scope === 'operacional'
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                "
              >
                {{ expense.scope }}
              </span>
              <span v-if="expense.payment_method" class="ml-1 text-xs text-slate-400">
                {{ expense.payment_method }}
              </span>
            </td>
            <td class="px-4 py-3 text-right tabular-nums text-slate-800">{{ money(expense.value) }}</td>
            <td class="px-4 py-3 text-right">
              <NxButton variant="ghost" size="sm" @click="edit(expense)">Editar</NxButton>
              <NxButton variant="ghost" size="sm" @click="destroy(expense)">Eliminar</NxButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <NxModal
      :model-value="open"
      :title="editing ? 'Editar gasto' : 'Nuevo gasto'"
      @update:model-value="open = false"
    >
      <div class="flex flex-col gap-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <NxDatePicker v-model="date" label="Fecha contable" :disabled="saving" />
          <NxInput v-model="value" label="Valor" inputmode="numeric" :disabled="saving" />
        </div>

        <NxInput v-model="description" label="Descripción" required :disabled="saving" />

        <!-- El alcance decide si el gasto descuadra la caja del mostrador.
             Pagar el arriendo no puede hacerlo. -->
        <NxSelect
          v-model="scope"
          :options="SCOPES"
          option-label="label"
          option-value="value"
          label="Alcance"
          :disabled="saving"
        />

        <div class="grid gap-3 sm:grid-cols-2">
          <NxSelect
            v-model="typeId"
            :options="types ?? []"
            option-label="name"
            option-value="id"
            label="Categoría (opcional)"
            :disabled="saving"
          />
          <NxSelect
            v-model="methodId"
            :options="methods ?? []"
            option-label="name"
            option-value="id"
            label="Pagado con"
            :disabled="saving"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm text-slate-600">Recibo (opcional)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
            :disabled="saving"
            @change="receipt = ($event.target as HTMLInputElement).files?.[0] ?? null"
          />
        </div>

        <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <div class="flex justify-end gap-2">
          <NxButton variant="secondary" :disabled="saving" @click="open = false">Cancelar</NxButton>
          <NxButton :loading="saving" :disabled="!canSubmit" @click="submit">Guardar</NxButton>
        </div>
      </div>
    </NxModal>
  </section>
</template>
