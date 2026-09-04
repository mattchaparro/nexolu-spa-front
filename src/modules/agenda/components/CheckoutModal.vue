<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { usePaymentMethods } from '@/composables/usePaymentMethods'
import { useAuthStore } from '@/stores/auth.store'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { wantsPaymentProof } from '@/utils/wantsPaymentProof'
import { NxButton, NxInput, NxModal, NxSelect } from '@/ui'

import StagePicker from './StagePicker.vue'

import { useClientLoyalty } from '@/modules/settings/composables/useLoyalty'
import { usePaymentProof } from '@/modules/mywork/composables/useMyWork'

import {
  useCancelAppointment,
  useCheckout,
  useRegisterDeposit,
  type Appointment,
} from '../composables/useAppointments'

const props = defineProps<{ appointment: Appointment | null }>()
const emit = defineEmits<{ close: []; done: []; cancelled: [] }>()

const { mutateAsync: cancelMutation } = useCancelAppointment()

async function cancelAppointment(): Promise<void> {
  if (!props.appointment) {
    return
  }

  const who = props.appointment.client_name ?? 'este cliente'

  if (!window.confirm(`¿Cancelar la cita de ${who}? El horario vuelve a quedar libre.`)) {
    return
  }

  await cancelMutation({ id: props.appointment.id })
  emit('cancelled')
}

const auth = useAuthStore()
const open = computed(() => props.appointment !== null)

const paymentMethodId = ref<number | null>(null)
const discount = ref('')
const discountReason = ref('')
const error = ref<string | null>(null)

const { data: methods } = usePaymentMethods()

const { mutateAsync, isPending } = useCheckout()
const { mutateAsync: uploadProof } = usePaymentProof()

const subtotal = computed(
  () => props.appointment?.items.reduce((sum, item) => sum + item.price, 0) ?? 0,
)
const discountValue = computed(() => Math.max(0, Number(discount.value) || 0))
const total = computed(() => Math.max(0, subtotal.value - discountValue.value))

/*
|------------------------------------------------------------------------------
| Abono
|------------------------------------------------------------------------------
| El abono NO es un descuento: la venta sigue siendo el total y la comisión se
| calcula sobre él. Lo único que cambia es cuánto pone el cliente hoy sobre el
| mostrador.
*/

const { mutateAsync: registerDeposit, isPending: registrandoAbono } = useRegisterDeposit()

/**
 * La cita recién devuelta por el servidor, si es la misma que está abierta.
 *
 * El modal recibe la cita del padre, y refrescar la lista no reemplaza ese
 * objeto: sin esto, registrar el abono lo dejaba diciendo "todavía sin
 * registrar" y ofreciendo cobrar el total, con la plata ya recibida.
 */
const recienActualizada = ref<Appointment | null>(null)

const cita = computed(() =>
  recienActualizada.value?.id === props.appointment?.id
    ? recienActualizada.value
    : props.appointment,
)

/** Lo que se pidió de abono y todavía no llega. */
const abonoPendiente = computed(
  () =>
    (cita.value?.deposit_amount ?? 0) > 0 &&
    cita.value?.deposit_paid_at === null &&
    cita.value?.is_paid === false,
)

const abonoRecibido = computed(() => cita.value?.deposit_paid ?? 0)

/** Lo que el cliente pone hoy: el total menos lo que ya abonó. */
const aCobrar = computed(() => Math.max(0, total.value - abonoRecibido.value))

async function marcarAbono(): Promise<void> {
  if (!props.appointment || paymentMethodId.value === null) {
    return
  }

  error.value = null

  try {
    recienActualizada.value = await registerDeposit({
      id: props.appointment.id,
      payment_method_id: paymentMethodId.value,
    })
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos registrar el abono.')
  }
}

/*
|------------------------------------------------------------------------------
| Tarjeta de sellos
|------------------------------------------------------------------------------
| El premio se ofrece acá, en el cobro, porque es el único momento en que
| alguien del local tiene delante a la clienta Y la cuenta. Dejarlo en la ficha
| obligaría a acordarse de ir a mirarla antes de cobrar, y no se acuerda nadie.
*/

const clienteId = computed(() => props.appointment?.client_id ?? null)
const { data: card } = useClientLoyalty(
  clienteId,
  computed(() => open.value && auth.hasFeature('loyalty')),
)

const premiosDisponibles = computed(() => card.value?.rewards ?? [])
const premioElegido = ref<number | null>(null)

const premio = computed(
  () => premiosDisponibles.value.find((r) => r.id === premioElegido.value) ?? null,
)

/** Lo que cada persona se lleva, con el descuento ya repartido. */
const commissions = computed(() => {
  const items = props.appointment?.items ?? []

  return items.map((item) => {
    const share = subtotal.value > 0 ? (item.price / subtotal.value) * discountValue.value : 0
    return {
      name: item.resource_name,
      rate: item.commission_rate ?? 0,
      amount: (item.price - share) * (item.commission_rate ?? 0),
    }
  })
})

watch(open, (isOpen) => {
  if (isOpen) {
    paymentMethodId.value = methods.value?.[0]?.id ?? null
    discount.value = ''
    discountReason.value = ''
    error.value = null
    // Se suelta la copia local: la cita que se abre ahora es otra.
    recienActualizada.value = null
    // El premio NO se preselecciona: gastar la tarjeta de alguien sin que
    // nadie lo haya elegido es peor que olvidar ofrecerlo.
    premioElegido.value = null
  }
})

watch(methods, (list) => {
  if (open.value && !paymentMethodId.value && list?.length) {
    paymentMethodId.value = list[0].id
  }
})

function money(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: auth.business?.currency ?? 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

/*
 * El comprobante de lo que entró.
 *
 * Se pide sólo cuando el medio de pago NO cuenta como efectivo: el efectivo
 * se cuenta en el cajón al cerrar el día y no necesita foto. Una
 * transferencia no se puede contar, y sin comprobante el cierre cuadra contra
 * lo que alguien dijo que entró — que es exactamente lo que el cierre existe
 * para no hacer.
 *
 * La política la resuelve el backend (`payment_proof_policy`); acá sólo se
 * cruza con el método elegido.
 */
const proofFile = ref<File | null>(null)

const asksProof = computed(() =>
  wantsPaymentProof(
    auth.business?.scheduling_settings?.payment_proof_policy,
    methods.value?.find((m) => m.id === paymentMethodId.value)?.counts_as_cash,
  ),
)

function onProof(event: Event): void {
  proofFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

const canSubmit = computed(
  () => paymentMethodId.value !== null && discountValue.value <= subtotal.value && !isPending.value,
)

async function submit(): Promise<void> {
  if (!props.appointment || paymentMethodId.value === null) {
    return
  }

  error.value = null

  try {
    await mutateAsync({
      id: props.appointment.id,
      payment_method_id: paymentMethodId.value,
      discount_amount: discountValue.value || undefined,
      discount_reason: discountReason.value.trim() || undefined,
      loyalty_reward_id: premioElegido.value,
    })
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos registrar el cobro.')

    return
  }

  /*
   * El comprobante DESPUÉS de cobrar, y sin poder tumbar el cobro.
   *
   * La plata es lo que importa: si la imagen falla —salió muy pesada, se cayó
   * la red— el cobro ya quedó y se dice que falta el comprobante, en vez de
   * bloquear una caja por una foto. Es el mismo criterio que con la foto del
   * trabajo: se pide, no se exige.
   */
  if (proofFile.value) {
    try {
      await uploadProof({ appointmentId: props.appointment.id, file: proofFile.value })
    } catch {
      error.value = 'El cobro quedó registrado, pero el comprobante no se pudo subir.'

      return
    }
  }

  emit('done')
}
</script>

<template>
  <NxModal :model-value="open" title="Cobrar servicio" @update:model-value="emit('close')">
    <div v-if="appointment" class="flex flex-col gap-4">
      <div class="rounded-md bg-slate-50 px-4 py-3 text-sm">
        <p class="font-medium text-slate-800">{{ appointment.client_name }}</p>
        <p
          v-for="item in appointment.items"
          :key="item.id"
          class="flex justify-between text-slate-600"
        >
          <span>{{ item.service_name }} · {{ item.resource_name }}</span>
          <span class="tabular-nums">{{ money(item.price) }}</span>
        </p>
      </div>

      <!-- El estado vive arriba del cobro: la mayoría de las veces que se abre
           esta cita es para confirmarla o marcar que llegó, no para cobrar.

           Mover de etapa NO cierra el modal ni emite `done`: `done` significa
           "se cobró" y dispara ese aviso. Confirmar una cita y que la pantalla
           anuncie un cobro que no ocurrió es peor que no avisar nada. La
           rejilla se refresca sola por invalidación. -->
      <div class="border-b border-slate-100 pb-4">
        <StagePicker :appointment-id="appointment.id" />
      </div>

      <NxSelect
        v-model="paymentMethodId"
        :options="methods ?? []"
        option-label="name"
        option-value="id"
        label="Método de pago"
        :disabled="isPending"
      />

      <!--
        Sólo cuando el medio de pago no es efectivo. Es la foto que hoy viaja
        por el grupo de WhatsApp junto a un texto que este sistema ya sabe.
      -->
      <div v-if="asksProof" class="rounded-md border border-slate-200 px-3 py-2">
        <p class="text-sm text-slate-700">Comprobante de la transferencia</p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          class="mt-1.5 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
          :disabled="isPending"
          @change="onProof"
        />
        <p class="mt-1 text-xs text-slate-400">
          Sin él, el cierre del día cuadra contra lo que alguien dijo que entró.
        </p>
      </div>

      <div class="flex gap-3">
        <div class="w-40">
          <NxInput v-model="discount" label="Descuento" inputmode="numeric" :disabled="isPending" />
        </div>
        <div class="flex-1">
          <NxInput
            v-model="discountReason"
            label="Motivo (opcional)"
            :disabled="isPending || discountValue === 0"
          />
        </div>
      </div>

      <!-- La tarjeta de sellos. Se muestra siempre que haya programa: ver que
           le faltan 2 sellos es lo que hace que quien cobra se lo diga, y eso
           es la mitad del valor del programa. -->
      <div
        v-if="card?.program"
        class="rounded-md border px-4 py-3 text-sm"
        :class="premiosDisponibles.length ? 'border-amber-300 bg-amber-50' : 'border-slate-200'"
      >
        <p v-if="!premiosDisponibles.length" class="text-slate-600">
          {{ card.program.name }}: {{ card.stamps }} de {{ card.required }} sellos ·
          <span class="text-slate-500">
            le faltan {{ card.remaining }} para {{ card.program.reward_label }}
          </span>
        </p>

        <template v-else>
          <p class="font-medium text-amber-900">
            Tiene
            {{
              premiosDisponibles.length === 1 ? 'un premio' : `${premiosDisponibles.length} premios`
            }}
            sin usar
          </p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="r in premiosDisponibles"
              :key="r.id"
              type="button"
              class="rounded-md border px-2.5 py-1.5 text-sm transition"
              :class="
                premioElegido === r.id
                  ? 'border-amber-600 bg-amber-600 font-medium text-white'
                  : 'border-amber-300 bg-white text-amber-900'
              "
              :disabled="isPending"
              @click="premioElegido = premioElegido === r.id ? null : r.id"
            >
              {{ r.label }}
            </button>
          </div>
          <p class="mt-1 text-xs text-amber-800">
            Tócalo para aplicarlo a este cobro. Si no, queda guardado para la próxima.
          </p>
        </template>
      </div>

      <div class="rounded-md border border-slate-200 px-4 py-3 text-sm">
        <p class="flex justify-between text-slate-600">
          <span>Subtotal</span><span class="tabular-nums">{{ money(subtotal) }}</span>
        </p>
        <!-- El premio no se resta acá: el servidor lo calcula y lo suma al
             descuento. Duplicar esa aritmética en el front es garantizar que
             un día las dos copias digan cosas distintas. -->
        <p v-if="premio" class="flex justify-between text-amber-700">
          <span>Premio · {{ premio.label }}</span>
          <span class="tabular-nums">se aplica al cobrar</span>
        </p>
        <p v-if="discountValue > 0" class="flex justify-between text-amber-700">
          <span>Descuento</span><span class="tabular-nums">−{{ money(discountValue) }}</span>
        </p>
        <p
          class="mt-1 flex justify-between border-t border-slate-100 pt-1 text-slate-900"
          :class="abonoRecibido > 0 ? '' : 'font-semibold'"
        >
          <span>Total</span><span class="tabular-nums">{{ money(total) }}</span>
        </p>
        <!-- El abono se resta de lo que pone hoy, no del total: la venta y la
             comisión siguen siendo sobre el precio completo. -->
        <template v-if="abonoRecibido > 0">
          <p class="flex justify-between text-emerald-700">
            <span>Abonó</span><span class="tabular-nums">−{{ money(abonoRecibido) }}</span>
          </p>
          <p
            class="mt-1 flex justify-between border-t border-slate-100 pt-1 font-semibold text-slate-900"
          >
            <span>A cobrar ahora</span><span class="tabular-nums">{{ money(aCobrar) }}</span>
          </p>
        </template>
      </div>

      <!-- Abono pedido que todavía no llega. Se registra desde acá, con el
           método que esté elegido arriba: si entra sin método, la plata no
           queda en ninguna cuenta y el cierre del día no cuadra. -->
      <div
        v-if="abonoPendiente"
        class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <p class="font-medium">
          Separó con abono de {{ money(cita?.deposit_amount ?? 0) }}, todavía sin registrar.
        </p>
        <p class="mt-0.5 text-xs">
          {{
            paymentMethodId === null
              ? 'Elige arriba por dónde llegó para registrarlo.'
              : 'Se registra con el método elegido arriba.'
          }}
        </p>
        <NxButton
          class="mt-2"
          size="sm"
          variant="secondary"
          :loading="registrandoAbono"
          :disabled="paymentMethodId === null || isPending"
          @click="marcarAbono"
        >
          Registrar abono recibido
        </NxButton>
      </div>

      <!-- La comisión se muestra ANTES de confirmar: quien cobra debe poder
           ver qué se le va a liquidar a cada persona, no enterarse
           después en un reporte. -->
      <div class="text-sm">
        <p class="mb-1 text-xs uppercase tracking-wide text-slate-400">Comisión</p>
        <p
          v-for="(commission, i) in commissions"
          :key="i"
          class="flex justify-between text-slate-600"
        >
          <span>{{ commission.name }} · {{ Math.round(commission.rate * 100) }}%</span>
          <span class="tabular-nums">{{ money(commission.amount) }}</span>
        </p>
      </div>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex items-center justify-between gap-2">
        <!-- Cancelar la cita vive aca porque este modal es, en la practica, el
             detalle de la cita: es donde se actua sobre ella. -->
        <NxButton
          v-if="auth.can('citas.cancelar')"
          variant="ghost"
          size="sm"
          :disabled="isPending"
          @click="cancelAppointment"
        >
          Cancelar cita
        </NxButton>
        <span v-else />

        <div class="flex gap-2">
          <NxButton variant="secondary" :disabled="isPending" @click="emit('close')"
            >Cerrar</NxButton
          >
          <NxButton :loading="isPending" :disabled="!canSubmit" @click="submit">
            Cobrar {{ money(aCobrar) }}
          </NxButton>
        </div>
      </div>
    </div>
  </NxModal>
</template>
