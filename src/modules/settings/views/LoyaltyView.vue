<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useServices } from '@/modules/agenda/composables/useAvailability'
import { NxButton, NxInput, NxSelect } from '@/ui'

import {
  useDisableLoyaltyProgram,
  useLoyaltyProgram,
  useSaveLoyaltyProgram,
  type LoyaltyMode,
  type RewardType,
} from '../composables/useLoyalty'

/** Un escalón mientras se edita: sin `reward_label`, que lo arma el servidor. */
interface TierForm {
  stamps_required: number
  reward_type: RewardType
  reward_value: number | null
  reward_service_id: number | null
  reward_note: string | null
}

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

/*
 * El modo y los escalones, que esta pantalla ignoraba.
 *
 * Luxury corre una ESCALERA de siete hitos (5, 10, 15, 20, 25, 30 y 35
 * sellos, con un producto de regalo a los 30). La pantalla mostraba un
 * formulario de tarjeta simple y anunciaba "Junta 5 sellos y llévate 10%",
 * que es solo el primer peldaño: la dueña no tenía forma de ver los otros
 * seis, ni de saber que existían.
 *
 * Y era peor que incompleto. El guardado mandaba `stamps_required` sin `mode`
 * ni `tiers`, y el backend lee justo eso para decidir: sin `mode: 'ladder'`
 * el programa se guarda como `card`. Es decir que abrir esta pantalla y
 * pulsar "Guardar" -- sin cambiar nada -- convertía la escalera en una
 * tarjeta de 5 sellos, y los 22 sellos de una clienta pasaban a leerse
 * contra otra regla. Un clic, sin aviso y sin vuelta atrás.
 */
const mode = ref<LoyaltyMode>('card')
const tiers = ref<TierForm[]>([])

const program = computed(() => data.value?.program ?? null)
const rewardTypes = computed(() => data.value?.reward_types ?? [])
const esServicioGratis = computed(() => rewardType.value === 'free_service')
const esEscalera = computed(() => mode.value === 'ladder')

/** Los escalones ordenados por sellos: es como se leen y como se guardan. */
const escalonesOrdenados = computed(() =>
  [...tiers.value].sort((a, b) => a.stamps_required - b.stamps_required),
)

function etiquetaPremio(t: TierForm): string {
  if (t.reward_type === 'free_service') {
    return `${services.value?.find((s) => s.id === t.reward_service_id)?.name ?? 'un servicio'} gratis`
  }

  if (t.reward_type === 'gift') {
    // Sin el punto final: la nota se escribe como frase suelta ("Recibe un
    // producto de nuestra marca al azar.") y acá va encadenada con " · ".
    return t.reward_note?.trim().replace(/\.$/, '') || 'un regalo'
  }

  return t.reward_type === 'discount_percent'
    ? `${t.reward_value ?? 0}% de descuento`
    : `${money(t.reward_value ?? 0)} de descuento`
}

function agregarEscalon(): void {
  const ultimo = escalonesOrdenados.value.at(-1)

  tiers.value.push({
    stamps_required: (ultimo?.stamps_required ?? 0) + 5,
    reward_type: 'discount_percent',
    reward_value: 10,
    reward_service_id: null,
    reward_note: null,
  })
}

function quitarEscalon(indice: number): void {
  tiers.value.splice(indice, 1)
}

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
    mode.value = p.mode

    tiers.value = p.tiers.map((t) => ({
      stamps_required: t.stamps_required,
      reward_type: t.reward_type,
      reward_value: t.reward_value,
      reward_service_id: t.reward_service_id,
      reward_note: t.reward_note,
    }))
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
  const minimoTexto =
    minTicket.value > 0 ? ` Sólo cuentan las visitas de ${money(minTicket.value)} o más.` : ''

  /*
   * La escalera se lee entera, no por su primer peldaño. Que quepa en una
   * frase es justamente lo que hace que se note si a los 30 quedó puesto un
   * premio que nadie quiso.
   */
  if (esEscalera.value) {
    if (!escalonesOrdenados.value.length) {
      return 'Una escalera necesita al menos dos escalones.'
    }

    const pasos = escalonesOrdenados.value
      .map((t) => `a los ${t.stamps_required}, ${etiquetaPremio(t)}`)
      .join(' · ')

    return `Los sellos no se gastan: ${pasos}.${minimoTexto}`
  }

  const premio = esServicioGratis.value
    ? `${services.value?.find((s) => s.id === rewardServiceId.value)?.name ?? 'un servicio'} gratis`
    : rewardType.value === 'discount_percent'
      ? `${rewardValue.value ?? 0}% de descuento`
      : `${money(rewardValue.value ?? 0)} de descuento`

  return `Junta ${stampsRequired.value} sellos y llévate ${premio}.${minimoTexto}`
})

const canSubmit = computed(() => {
  if (!name.value.trim()) {
    return false
  }

  if (esEscalera.value) {
    // Las mismas reglas que el backend, para que el error salga acá y no
    // despues de un viaje al servidor.
    const ordenados = escalonesOrdenados.value

    return (
      ordenados.length >= 2 &&
      new Set(ordenados.map((t) => t.stamps_required)).size === ordenados.length &&
      ordenados.every((t) => t.stamps_required >= 2 && premioCompleto(t))
    )
  }

  if (stampsRequired.value < 2) {
    return false
  }

  return esServicioGratis.value ? rewardServiceId.value !== null : (rewardValue.value ?? 0) > 0
})

/** Un escalón sirve si su premio esta completo segun su tipo. */
function premioCompleto(t: TierForm): boolean {
  if (t.reward_type === 'free_service') return t.reward_service_id !== null
  if (t.reward_type === 'gift') return (t.reward_note ?? '').trim().length > 0

  return (t.reward_value ?? 0) > 0
}

async function submit(): Promise<void> {
  error.value = null

  try {
    const comun = {
      name: name.value.trim(),
      terms: terms.value.trim() || null,
      min_ticket: Number(minTicket.value) || 0,
      is_active: true,
      // SIEMPRE explicito. El backend interpreta su ausencia como `card`, asi
      // que omitirlo en una escalera la degradaba en silencio.
      mode: mode.value,
    }

    await save(
      esEscalera.value
        ? {
            ...comun,
            tiers: escalonesOrdenados.value.map((t) => ({
              stamps_required: Number(t.stamps_required),
              reward_type: t.reward_type,
              reward_value: t.reward_type === 'discount_percent' || t.reward_type === 'discount_amount'
                ? Number(t.reward_value)
                : null,
              reward_service_id: t.reward_type === 'free_service' ? t.reward_service_id : null,
              reward_note: t.reward_type === 'gift' ? (t.reward_note?.trim() ?? null) : null,
              reward_label: '',
            })),
          }
        : {
            ...comun,
            stamps_required: Number(stampsRequired.value),
            reward_type: rewardType.value,
            reward_value: esServicioGratis.value ? null : Number(rewardValue.value),
            reward_service_id: esServicioGratis.value ? rewardServiceId.value : null,
          },
    )
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

        <!-- LA ESCALERA. Antes no se veía ninguno de sus escalones: la
             pantalla mostraba el formulario de tarjeta simple y anunciaba el
             primer peldaño como si fuera todo el programa. -->
        <div v-if="esEscalera" class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between">
            <p class="text-sm font-medium text-slate-700">Escalones</p>
            <p class="text-xs text-slate-500">Los sellos no se gastan: se acumulan.</p>
          </div>

          <!-- Se recorre `tiers` y NO la lista ordenada: reordenar mientras
               alguien escribe le mueve la fila bajo el cursor. Se ordena al
               guardar y al leer la vista previa, que es cuando importa. -->
          <div
            v-for="(t, i) in tiers"
            :key="i"
            class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5"
          >
            <div class="flex flex-wrap items-end gap-3">
              <label class="text-xs text-slate-600">
                Sellos
                <input
                  v-model.number="t.stamps_required"
                  type="number"
                  min="2"
                  max="500"
                  class="mt-1 w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  :disabled="isPending"
                />
              </label>

              <label class="min-w-[10rem] flex-1 text-xs text-slate-600">
                Qué se gana
                <select
                  v-model="t.reward_type"
                  class="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  :disabled="isPending"
                >
                  <option v-for="r in rewardTypes" :key="r.value" :value="r.value">
                    {{ r.label }}
                  </option>
                </select>
              </label>

              <label
                v-if="t.reward_type === 'discount_percent' || t.reward_type === 'discount_amount'"
                class="text-xs text-slate-600"
              >
                {{ t.reward_type === 'discount_percent' ? '%' : 'Monto' }}
                <input
                  v-model.number="t.reward_value"
                  type="number"
                  min="1"
                  class="mt-1 w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  :disabled="isPending"
                />
              </label>

              <label v-else-if="t.reward_type === 'free_service'" class="min-w-[10rem] flex-1 text-xs text-slate-600">
                Servicio
                <select
                  v-model="t.reward_service_id"
                  class="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  :disabled="isPending"
                >
                  <option v-for="sv in services ?? []" :key="sv.id" :value="sv.id">
                    {{ sv.name }}
                  </option>
                </select>
              </label>

              <label v-else class="min-w-[12rem] flex-1 text-xs text-slate-600">
                Qué se entrega
                <input
                  v-model="t.reward_note"
                  type="text"
                  maxlength="200"
                  placeholder="Un producto de nuestra marca"
                  class="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                  :disabled="isPending"
                />
              </label>

              <button
                type="button"
                class="pb-1.5 text-xs text-slate-400 underline hover:text-red-600"
                :disabled="isPending"
                @click="quitarEscalon(i)"
              >
                Quitar
              </button>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <NxButton variant="outline" size="sm" :disabled="isPending" @click="agregarEscalon">
              Agregar escalón
            </NxButton>
            <span v-if="escalonesOrdenados.length < 2" class="text-xs text-amber-700">
              Una escalera necesita al menos dos escalones.
            </span>
          </div>

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

        <div v-else class="grid gap-3 sm:grid-cols-2">
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
          v-if="!esEscalera"
          v-model="rewardType"
          :options="rewardTypes"
          option-label="label"
          option-value="value"
          label="Qué se gana"
          :disabled="isPending"
        />

        <NxSelect
          v-if="!esEscalera && esServicioGratis"
          v-model="rewardServiceId"
          :options="services ?? []"
          option-label="name"
          option-value="id"
          label="Servicio de regalo"
          :disabled="isPending"
        />

        <label v-else-if="!esEscalera" class="text-sm text-slate-700">
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
