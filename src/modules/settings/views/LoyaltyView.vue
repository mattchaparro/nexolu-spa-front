<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useServices } from '@/modules/agenda/composables/useAvailability'
import { NxButton, NxInput, NxSelect } from '@/ui'

import {
  useDisableLoyaltyProgram,
  useLoyaltyProgram,
  useSaveLoyaltyProgram,
  type RewardType,
} from '../composables/useLoyalty'

const { notify } = useSystemAlert()

const { data, isLoading } = useLoyaltyProgram()
const { mutateAsync: save, isPending } = useSaveLoyaltyProgram()
const { mutateAsync: disable } = useDisableLoyaltyProgram()
const { data: services } = useServices()

const name = ref('Tarjeta de sellos')
const terms = ref('')
const stampsRequired = ref(5)
const rewardType = ref<RewardType>('discount_percent')
const rewardValue = ref<number | null>(100)
const rewardServiceId = ref<number | null>(null)
const minTicket = ref(0)
const error = ref<string | null>(null)

const program = computed(() => data.value?.program ?? null)
const rewardTypes = computed(() => data.value?.reward_types ?? [])
const esServicioGratis = computed(() => rewardType.value === 'free_service')

watch(
  program,
  (p) => {
    if (!p) {
      return
    }

    name.value = p.name
    terms.value = p.terms ?? ''
    stampsRequired.value = p.stamps_required
    rewardType.value = p.reward_type
    rewardValue.value = p.reward_value
    rewardServiceId.value = p.reward_service_id
    minTicket.value = p.min_ticket
  },
  { immediate: true },
)

function money(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Cómo se le va a leer al cliente, con lo que hay escrito ahora mismo.
 *
 * Es la frase que va a estar en la pared del local: verla antes de guardar
 * evita descubrir en el mostrador que la tarjeta dice algo que nadie quiso.
 */
const vistaPrevia = computed(() => {
  const premio = esServicioGratis.value
    ? `${services.value?.find((s) => s.id === rewardServiceId.value)?.name ?? 'un servicio'} gratis`
    : rewardType.value === 'discount_percent'
      ? `${rewardValue.value ?? 0}% de descuento`
      : `${money(rewardValue.value ?? 0)} de descuento`

  const minimo =
    minTicket.value > 0 ? ` Sólo cuentan las visitas de ${money(minTicket.value)} o más.` : ''

  return `Junta ${stampsRequired.value} sellos y llévate ${premio}.${minimo}`
})

const canSubmit = computed(() => {
  if (!name.value.trim() || stampsRequired.value < 2) {
    return false
  }

  return esServicioGratis.value ? rewardServiceId.value !== null : (rewardValue.value ?? 0) > 0
})

async function submit(): Promise<void> {
  error.value = null

  try {
    await save({
      name: name.value.trim(),
      terms: terms.value.trim() || null,
      stamps_required: Number(stampsRequired.value),
      reward_type: rewardType.value,
      reward_value: esServicioGratis.value ? null : Number(rewardValue.value),
      reward_service_id: esServicioGratis.value ? rewardServiceId.value : null,
      min_ticket: Number(minTicket.value) || 0,
      is_active: true,
    })
    notify('Tarjeta guardada.', 'success')
  } catch (e) {
    error.value =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      'No pudimos guardar la tarjeta.'
  }
}

async function apagar(): Promise<void> {
  if (
    !window.confirm(
      '¿Apagar la tarjeta de sellos? Los sellos y premios ya ganados se conservan, pero deja de sumar.',
    )
  ) {
    return
  }

  await disable()
  notify('Tarjeta apagada.', 'success')
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Tarjeta de sellos</h1>
      <p class="mt-1 text-sm text-slate-500">
        Un sello por visita cobrada. Al llenar la tarjeta, el premio queda disponible para el
        siguiente cobro.
      </p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <div v-else class="max-w-2xl">
      <!-- La frase que va a estar en la pared del local. Verla antes de
           guardar evita descubrir en el mostrador que la tarjeta dice algo
           que nadie quiso. -->
      <div class="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
        <p class="text-xs font-medium uppercase tracking-wide text-indigo-500">Así se lee</p>
        <p class="mt-1 text-indigo-900">{{ vistaPrevia }}</p>
      </div>

      <div class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <NxInput v-model="name" label="Nombre de la tarjeta" :disabled="isPending" />

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="text-sm text-slate-700">
            Sellos para el premio
            <input
              v-model.number="stampsRequired"
              type="number"
              min="2"
              max="100"
              class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              :disabled="isPending"
            />
            <!-- Una tarjeta de 1 regala en cada visita: no es fidelización,
                 es una rebaja permanente. El backend también lo rechaza. -->
            <span v-if="stampsRequired < 2" class="mt-1 block text-xs text-amber-700">
              Mínimo 2. Con uno solo estarías regalando en cada visita.
            </span>
          </label>

          <label class="text-sm text-slate-700">
            Visita mínima para sellar
            <input
              v-model.number="minTicket"
              type="number"
              min="0"
              step="1000"
              class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              :disabled="isPending"
            />
            <span class="mt-1 block text-xs text-slate-500">
              0 = toda visita cuenta. Sirve para que un retoque barato no llene la tarjeta igual que
              un servicio completo.
            </span>
          </label>
        </div>

        <NxSelect
          v-model="rewardType"
          :options="rewardTypes"
          option-label="label"
          option-value="value"
          label="Qué se gana"
          :disabled="isPending"
        />

        <NxSelect
          v-if="esServicioGratis"
          v-model="rewardServiceId"
          :options="services ?? []"
          option-label="name"
          option-value="id"
          label="Servicio de regalo"
          :disabled="isPending"
        />

        <label v-else class="text-sm text-slate-700">
          {{ rewardType === 'discount_percent' ? 'Porcentaje de descuento' : 'Monto de descuento' }}
          <input
            v-model.number="rewardValue"
            type="number"
            min="1"
            :max="rewardType === 'discount_percent' ? 100 : undefined"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            :disabled="isPending"
          />
        </label>

        <NxInput v-model="terms" label="Letra chica (opcional)" :disabled="isPending" />

        <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <div class="flex items-center justify-between gap-2">
          <NxButton v-if="program" variant="ghost" size="sm" @click="apagar"
            >Apagar tarjeta</NxButton
          >
          <span v-else />
          <NxButton :loading="isPending" :disabled="!canSubmit" @click="submit">Guardar</NxButton>
        </div>
      </div>

      <p v-if="!program" class="mt-3 text-sm text-slate-500">
        Todavía no hay tarjeta activa. Los sellos empiezan a sumarse desde el primer cobro después
        de guardarla — las visitas anteriores no cuentan hacia atrás.
      </p>
    </div>
  </section>
</template>
