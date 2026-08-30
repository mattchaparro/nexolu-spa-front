<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useServices } from '@/modules/agenda/composables/useAvailability'
import { NxButton, NxInput, NxModal, NxSelect } from '@/ui'

import {
  useCampaigns,
  useDisableCampaign,
  useSaveCampaign,
  useServiceCategories,
  type Campaign,
  type CampaignScope,
  type CampaignType,
} from '../composables/useCampaigns'

const { notify } = useSystemAlert()

const { data, isLoading } = useCampaigns()
const { mutateAsync: save, isPending } = useSaveCampaign()
const { mutateAsync: disable } = useDisableCampaign()
const { data: services } = useServices()
const { data: categories } = useServiceCategories()

const campaigns = computed(() => data.value?.campaigns ?? [])
const types = computed(() => data.value?.types ?? [])
const scopes = computed(() => data.value?.scopes ?? [])

const open = ref(false)
const editing = ref<Campaign | null>(null)
const error = ref<string | null>(null)

const name = ref('')
const description = ref('')
const type = ref<CampaignType>('percent')
const value = ref<number>(20)
const scope = ref<CampaignScope>('all')
const serviceIds = ref<number[]>([])
const categoryIds = ref<number[]>([])
const startsOn = ref('')
const endsOn = ref('')

const hoy = new Date().toLocaleDateString('sv-SE')

function money(n: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)
}

/**
 * Cómo se va a leer, con lo que hay escrito ahora mismo.
 *
 * Es la frase del aviso. Verla antes de guardar evita descubrir en el
 * mostrador que la promoción dice algo que nadie quiso.
 */
const vistaPrevia = computed(() => {
  const cuanto = type.value === 'percent' ? `${value.value}%` : money(value.value)
  const donde =
    scope.value === 'all'
      ? 'en todos los servicios'
      : scope.value === 'services'
        ? `en ${serviceIds.value.length} servicio(s)`
        : `en ${categoryIds.value.length} categoría(s)`
  const hasta = endsOn.value ? ` hasta el ${endsOn.value}` : ' sin fecha de fin'

  return `${name.value || 'Tu campaña'}: −${cuanto} ${donde},${hasta}.`
})

function abrir(campaign: Campaign | null): void {
  editing.value = campaign
  error.value = null

  name.value = campaign?.name ?? ''
  description.value = campaign?.description ?? ''
  type.value = campaign?.discount_type ?? 'percent'
  value.value = campaign?.discount_value ?? 20
  scope.value = campaign?.applies_to ?? 'all'
  serviceIds.value = campaign?.service_ids ?? []
  categoryIds.value = campaign?.category_ids ?? []
  startsOn.value = campaign?.starts_on ?? hoy
  endsOn.value = campaign?.ends_on ?? ''

  open.value = true
}

/**
 * Marca y desmarca dentro del alcance.
 *
 * Recibe cuál lista y no la ref: en el template los refs vienen ya
 * desenvueltos, así que pasar `serviceIds` desde el `@click` entregaría el
 * array y no la referencia.
 */
function toggle(cual: 'services' | 'categories', id: number): void {
  const list = cual === 'services' ? serviceIds : categoryIds

  list.value = list.value.includes(id)
    ? list.value.filter((x) => x !== id)
    : [...list.value, id]
}

const canSubmit = computed(() => {
  if (!name.value.trim() || !startsOn.value || value.value <= 0) return false
  if (type.value === 'percent' && value.value > 100) return false
  if (scope.value === 'services') return serviceIds.value.length > 0
  if (scope.value === 'categories') return categoryIds.value.length > 0

  return true
})

async function submit(): Promise<void> {
  error.value = null

  try {
    await save({
      id: editing.value?.id,
      name: name.value.trim(),
      description: description.value.trim() || null,
      discount_type: type.value,
      discount_value: Number(value.value),
      applies_to: scope.value,
      service_ids: serviceIds.value,
      category_ids: categoryIds.value,
      starts_on: startsOn.value,
      ends_on: endsOn.value || null,
      is_active: true,
    })
    open.value = false
    notify('Campaña guardada.', 'success')
  } catch (e) {
    error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? 'No pudimos guardar la campaña.'
  }
}

async function apagar(campaign: Campaign): Promise<void> {
  if (!window.confirm(`¿Apagar "${campaign.name}"? Deja de aplicarse desde ya.`)) return

  await disable(campaign.id)
  notify('Campaña apagada.', 'success')
}

// Cambiar de alcance limpia lo que ya no aplica: dejar servicios marcados en
// una campaña que pasó a ser "todos" guarda datos que nada lee.
watch(scope, (nuevo) => {
  if (nuevo !== 'services') serviceIds.value = []
  if (nuevo !== 'categories') categoryIds.value = []
})
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Campañas</h1>
        <p class="mt-1 text-sm text-slate-500">
          El mes de la madre, la semana de pestañas. Se aplican solas al cobrar, dentro de sus
          fechas.
        </p>
      </div>
      <NxButton @click="abrir(null)">Nueva campaña</NxButton>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <template v-else>
      <p v-if="!campaigns.length" class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600">
        Todavía no hay campañas. Crea una para que el descuento se aplique solo en las fechas que
        elijas.
      </p>

      <div v-else class="grid gap-3 sm:grid-cols-2">
        <article
          v-for="c in campaigns"
          :key="c.id"
          class="rounded-lg border bg-white p-4"
          :class="c.running ? 'border-indigo-300' : 'border-slate-200 opacity-70'"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="font-medium text-slate-800">{{ c.name }}</p>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="c.running ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'"
            >
              {{ c.running ? 'Vigente' : c.is_active ? 'Programada' : 'Apagada' }}
            </span>
          </div>

          <p class="mt-1 text-sm text-slate-600">{{ c.label }}</p>
          <p class="mt-1 text-xs text-slate-500">
            {{ c.starts_on }} → {{ c.ends_on ?? 'sin fecha de fin' }}
          </p>

          <div class="mt-3 flex gap-2">
            <NxButton variant="outline" size="sm" @click="abrir(c)">Editar</NxButton>
            <NxButton v-if="c.is_active" variant="ghost" size="sm" @click="apagar(c)">
              Apagar
            </NxButton>
          </div>
        </article>
      </div>
    </template>

    <NxModal
      :model-value="open"
      :title="editing ? 'Editar campaña' : 'Nueva campaña'"
      @update:model-value="open = false"
    >
      <div class="flex flex-col gap-4">
        <!-- La frase del aviso, armada con lo que hay escrito. Verla antes de
             guardar evita descubrir en el mostrador que la promoción dice algo
             que nadie quiso. -->
        <div class="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p class="text-xs font-medium uppercase tracking-wide text-indigo-500">Así se lee</p>
          <p class="mt-1 text-sm text-indigo-900">{{ vistaPrevia }}</p>
        </div>

        <NxInput v-model="name" label="Nombre" :disabled="isPending" />

        <div class="grid gap-3 sm:grid-cols-2">
          <NxSelect
            v-model="type"
            :options="types"
            option-label="label"
            option-value="value"
            label="Tipo de descuento"
            :disabled="isPending"
          />
          <label class="text-sm text-slate-700">
            {{ type === 'percent' ? 'Porcentaje' : 'Monto' }}
            <input
              v-model.number="value"
              type="number"
              min="1"
              :max="type === 'percent' ? 100 : undefined"
              class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              :disabled="isPending"
            />
          </label>
        </div>

        <NxSelect
          v-model="scope"
          :options="scopes"
          option-label="label"
          option-value="value"
          label="A qué aplica"
          :disabled="isPending"
        />

        <div v-if="scope === 'services'" class="flex flex-wrap gap-2">
          <button
            v-for="s in services ?? []"
            :key="s.id"
            type="button"
            class="rounded-md border px-2.5 py-1.5 text-sm"
            :class="
              serviceIds.includes(s.id)
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-200 text-slate-700'
            "
            @click="toggle('services', s.id)"
          >
            {{ s.name }}
          </button>
        </div>

        <div v-if="scope === 'categories'" class="flex flex-wrap gap-2">
          <button
            v-for="c in categories ?? []"
            :key="c.id"
            type="button"
            class="rounded-md border px-2.5 py-1.5 text-sm"
            :class="
              categoryIds.includes(c.id)
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-200 text-slate-700'
            "
            @click="toggle('categories', c.id)"
          >
            {{ c.name }}
          </button>
          <p v-if="!(categories ?? []).length" class="text-sm text-slate-500">
            Todavía no hay categorías. Créalas desde Servicios.
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="text-sm text-slate-700">
            Desde
            <input
              v-model="startsOn"
              type="date"
              class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              :disabled="isPending"
            />
          </label>
          <label class="text-sm text-slate-700">
            Hasta (opcional)
            <input
              v-model="endsOn"
              type="date"
              :min="startsOn"
              class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              :disabled="isPending"
            />
            <!-- El último día cuenta: lo contrario se descubre con la clienta
                 reclamando el mismo día que vio el aviso. -->
            <span class="mt-1 block text-xs text-slate-500">
              El último día también aplica. Vacío = corre hasta que la apagues.
            </span>
          </label>
        </div>

        <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <p class="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Si una cita también tiene combo, se aplica el descuento mayor — no se suman. Un descuento
          escrito a mano al cobrar manda sobre ambos.
        </p>

        <div class="flex justify-end gap-2">
          <NxButton variant="secondary" :disabled="isPending" @click="open = false">
            Cancelar
          </NxButton>
          <NxButton :loading="isPending" :disabled="!canSubmit" @click="submit">Guardar</NxButton>
        </div>
      </div>
    </NxModal>
  </section>
</template>
