<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { httpClient } from '@/services/http/client'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton } from '@/ui'

interface CatalogRow {
  id: number
  label: string
  counts_as_cash: boolean
  enabled: boolean
}

const { notify } = useSystemAlert()
const queryClient = useQueryClient()

const { data: catalog, isLoading } = useQuery({
  queryKey: ['payment-methods', 'catalog'],
  queryFn: async () => (await httpClient.get<CatalogRow[]>('/payment-methods/catalog')).data,
})

const { mutateAsync: sync, isPending } = useMutation({
  mutationFn: async (ids: number[]) =>
    (await httpClient.put<CatalogRow[]>('/payment-methods/catalog', {
      platform_payment_method_ids: ids,
    })).data,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['payment-methods'] })
    queryClient.invalidateQueries({ queryKey: ['cash'] })
  },
})

const selected = ref<Set<number>>(new Set())
const error = ref<string | null>(null)

watch(
  catalog,
  (rows) => {
    if (rows) {
      selected.value = new Set(rows.filter((r) => r.enabled).map((r) => r.id))
    }
  },
  { immediate: true },
)

function toggle(id: number): void {
  const next = new Set(selected.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selected.value = next
}

const changed = computed(() => {
  const original = new Set((catalog.value ?? []).filter((r) => r.enabled).map((r) => r.id))
  if (original.size !== selected.value.size) return true
  return [...selected.value].some((id) => !original.has(id))
})

async function save(): Promise<void> {
  error.value = null

  try {
    await sync([...selected.value])
    notify('Medios de pago actualizados.', 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar los medios de pago.')
  }
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Medios de pago</h1>
      <p class="mt-1 text-sm text-slate-500">
        Elige con qué pueden pagar tus clientes. El catálogo lo mantiene Nexolú.
      </p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <div v-else class="max-w-xl">
      <div class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        <label
          v-for="row in catalog ?? []"
          :key="row.id"
          class="flex items-center gap-3 px-4 py-3"
        >
          <input
            type="checkbox"
            :checked="selected.has(row.id)"
            :disabled="isPending"
            @change="toggle(row.id)"
          />
          <span class="flex-1 text-sm text-slate-800">{{ row.label }}</span>
          <!-- Que algo entre al cajón lo decide el medio, no el negocio:
               poder marcarlo aquí permitiría llamar "efectivo" al datáfono y
               descuadrar todos los cierres. -->
          <span
            class="rounded px-2 py-0.5 text-xs"
            :class="row.counts_as_cash ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'"
          >
            {{ row.counts_as_cash ? 'entra a la caja' : 'no es efectivo' }}
          </span>
        </label>
      </div>

      <p class="mt-2 text-xs text-slate-500">
        Al quitar un medio deja de ofrecerse, pero los cobros anteriores lo conservan.
      </p>

      <p v-if="error" class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <NxButton class="mt-4" :loading="isPending" :disabled="!changed" @click="save">
        Guardar cambios
      </NxButton>
    </div>
  </section>
</template>
