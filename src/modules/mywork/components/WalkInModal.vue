<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'
import { usePaymentMethods } from '@/composables/usePaymentMethods'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxModal, NxSelect } from '@/ui'

import SinAvisar from '@/modules/agenda/components/SinAvisar.vue'

import {
  searchClients,
  useClientLookup,
  type ClientOption,
} from '@/modules/agenda/composables/useAppointments'
import { useAuthStore } from '@/stores/auth.store'
import { useServices } from '@/modules/agenda/composables/useAvailability'
import { useMoney } from '@/modules/cash/composables/useMoney'
import { toLocalDateIso } from '@/utils/toLocalDateIso'

import { useWalkIn } from '../composables/useMyWork'

/*
 * El día que se está registrando sobrevive al cierre del modal.
 *
 * Es fuera del componente a propósito. Ponerse al día no es registrar UN
 * servicio: Alejandra abre esto ocho veces seguidas para el sábado pasado, y
 * si cada vez vuelve a "hoy", a la tercera se le pasa cambiarlo y el servicio
 * queda en el día equivocado -- con su comisión y el cierre de caja detrás.
 */
const ultimaFecha = ref(toLocalDateIso())

const props = defineProps<{
  open: boolean
  /** Recurso propio, si quien registra atiende. */
  myResourceId: number | null
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const { money } = useMoney()
const { mutateAsync, isPending } = useWalkIn()

/** Registrarlo sin mandarle el gracias a la clienta: subir lo de otro día. */
const silent = ref(false)

const { data: services } = useServices()

const { data: resources } = useQuery({
  queryKey: ['resources'],
  staleTime: 5 * 60_000,
  queryFn: async () =>
    (await httpClient.get<Array<{ id: number; name: string; type: string }>>('/resources')).data,
})

const { data: methods } = usePaymentMethods()

const auth = useAuthStore()
const { mutateAsync: buscarPorTelefono } = useClientLookup()

/*
 * Buscar por NOMBRE es abrir la base, y quien atiende no tiene ese permiso
 * (`clientes.ver`): la API le responde 403. Antes se le pedía igual, el
 * desplegable quedaba vacío sin decir por qué, y le creaba ficha nueva a una
 * clienta que ya existía -- con su historial y sus sellos en la ficha vieja.
 *
 * Ella identifica como en el cobro: por TELÉFONO COMPLETO, de a una.
 */
const puedeBuscarPorNombre = computed(() => auth.can('clientes.ver'))

const staff = computed(() => resources.value?.filter((r) => r.type === 'staff') ?? [])

const serviceId = ref<number | null>(null)
const resourceId = ref<number | null>(null)
const term = ref('')
const results = ref<ClientOption[]>([])
const selected = ref<ClientOption | null>(null)
const phone = ref('')
const methodId = ref<number | null>(null)
const price = ref('')
const chargeNow = ref(true)
const error = ref<string | null>(null)

const fecha = ref(ultimaFecha.value)
const hora = ref('')

const hoy = toLocalDateIso()
const esDeHoy = computed(() => fecha.value === hoy)

/** Cómo se lee el día que quedó elegido, para poder confirmarlo de un vistazo. */
const diaElegido = computed(() =>
  new Date(`${fecha.value}T12:00`).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }),
)

/** La hora a la que habría empezado si termina justo ahora. */
function horaSugerida(): string {
  const d = new Date(Date.now() - (service.value?.duration_min ?? 60) * 60_000)
  d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0)

  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const service = computed(() => services.value?.find((s) => s.id === serviceId.value) ?? null)

/** Quien no atiende tiene que decir quién lo hizo. */
const mustPickResource = computed(() => props.myResourceId === null)

/** El nombre que devolvió identificar por teléfono, si lo hubo. */
const identificada = ref<string | null>(null)

let timer: ReturnType<typeof setTimeout> | undefined
watch(term, (value) => {
  /*
   * Identificar por teléfono ESCRIBE el nombre, y eso dispara este watcher.
   * Sin esta guarda se borraba la selección que acababa de hacerse: la
   * pantalla decía "es Gisel M." y la visita se guardaba en una ficha NUEVA
   * -- duplicada, sin su historial ni sus sellos. Se vio probándolo.
   */
  if (identificada.value !== null && value === identificada.value) {
    return
  }

  selected.value = null

  if (!puedeBuscarPorNombre.value) {
    return
  }

  clearTimeout(timer)
  timer = setTimeout(async () => {
    results.value = await searchClients(value)
  }, 250)
})

/*
 * El teléfono completo sí identifica: se pregunta de a una y la respuesta es
 * un nombre de pila con la inicial. Así la visita cae en la ficha que ya
 * existe en vez de crear una repetida.
 */
let timerTelefono: ReturnType<typeof setTimeout> | undefined

watch(phone, (value) => {
  identificada.value = null
  clearTimeout(timerTelefono)

  if (puedeBuscarPorNombre.value || value.replace(/\D/g, '').length < 7) {
    return
  }

  timerTelefono = setTimeout(async () => {
    try {
      const r = await buscarPorTelefono(value)

      if (r.found && r.client) {
        // `display_name` es lo único que devuelve identificar: un nombre de
        // pila con la inicial. No trae teléfono ni correo, a propósito.
        identificada.value = r.client.display_name
        selected.value = {
          id: r.client.id,
          full_name: r.client.display_name,
          phone: value,
          label: r.client.display_name,
        }
        term.value = r.client.display_name
      }
    } catch {
      // Sin permiso o sin red: se sigue con el nombre escrito, que es lo
      // que hacía antes. No se le pone un error encima de un campo opcional.
    }
  }, 400)
})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return

    serviceId.value = services.value?.[0]?.id ?? null
    resourceId.value = props.myResourceId
    term.value = ''
    results.value = []
    selected.value = null
    phone.value = ''
    methodId.value = methods.value?.[0]?.id ?? null
    price.value = ''
    chargeNow.value = true
    silent.value = false
    error.value = null
    fecha.value = ultimaFecha.value
    hora.value = fecha.value === hoy ? horaSugerida() : hora.value || '10:00'
  },
)

/*
 * Nunca hacia adelante. Esto registra lo que YA se hizo -- un servicio con
 * fecha de mañana ensucia el cierre de un día que todavía no existe -- y en un
 * campo de fecha en el celular tocar el año de más es de lo más fácil.
 */
watch(fecha, (valor) => {
  if (valor > hoy) fecha.value = hoy
})

watch(service, (s) => {
  // El precio de lista como punto de partida, editable: un servicio sin cita
  // se negocia más a menudo que uno agendado.
  price.value = s ? String(s.price) : ''
})

function choose(client: ClientOption): void {
  selected.value = client
  term.value = client.full_name
  results.value = []
}

const canSubmit = computed(
  () =>
    serviceId.value !== null &&
    term.value.trim().length > 1 &&
    (!mustPickResource.value || resourceId.value !== null) &&
    !isPending.value,
)

async function submit(): Promise<void> {
  error.value = null

  try {
    await mutateAsync({
      service_id: serviceId.value!,
      resource_id: resourceId.value,
      client_id: selected.value?.id ?? null,
      client_name: selected.value?.full_name ?? term.value.trim(),
      client_phone: selected.value ? undefined : phone.value.trim() || undefined,
      // El servidor la interpreta en la zona del negocio, no en la del
      // teléfono: la cita es a las 2 de la tarde en el local, pase lo que pase
      // con el reloj de quien la registra.
      started_at: `${fecha.value}T${hora.value || '10:00'}`,
      payment_method_id: chargeNow.value ? methodId.value : null,
      final_price: chargeNow.value && price.value !== '' ? Number(price.value) : undefined,
      silent: silent.value || undefined,
    })
    // Se recuerda para el siguiente: ponerse al día son varios del mismo día.
    ultimaFecha.value = fecha.value
    emit('saved')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos registrar el servicio.')
  }
}
</script>

<template>
  <NxModal :model-value="open" title="Servicio sin cita" @update:model-value="emit('close')">
    <div class="flex flex-col gap-4">
      <p class="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Para alguien que llegó sin agendar, o para registrar un servicio que ya hiciste otro día.
        Queda igual que una cita: cuenta para tu comisión y para el cierre de ese día.
      </p>

      <NxSelect
        v-model="serviceId"
        :options="services ?? []"
        option-label="name"
        option-value="id"
        label="Servicio"
        :disabled="isPending"
      />

      <NxSelect
        v-if="mustPickResource"
        v-model="resourceId"
        :options="staff"
        option-label="name"
        option-value="id"
        label="¿Quién atendió?"
        :disabled="isPending"
      />

      <!-- Cuándo fue. Va arriba y no escondido en "avanzado": el día decide en
           qué cierre de caja cae la plata y en qué corte la comisión. -->
      <div class="grid grid-cols-2 gap-3">
        <NxInput v-model="fecha" type="date" label="¿Qué día?" :disabled="isPending" />
        <NxInput v-model="hora" type="time" label="¿A qué hora?" :disabled="isPending" />
      </div>

      <!-- Se confirma el día en palabras. Un teclado numérico en un date input
           es justo donde uno escribe 08 en vez de 09 y no lo nota. -->
      <p
        v-if="!esDeHoy"
        class="rounded-md border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        Se registrará el <span class="font-medium">{{ diaElegido }}</span
        >, no hoy.
      </p>

      <div class="relative">
        <NxInput v-model="term" label="Cliente" :disabled="isPending" autocomplete="off" />

        <ul
          v-if="results.length"
          class="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        >
          <li v-for="client in results" :key="client.id">
            <button
              type="button"
              class="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              @click="choose(client)"
            >
              {{ client.label }}
            </button>
          </li>
        </ul>

        <p v-if="identificada" class="mt-1 text-xs text-emerald-700">
          Es {{ identificada }}: la visita queda en su ficha.
        </p>
        <p v-else-if="selected" class="mt-1 text-xs text-emerald-700">
          Cliente existente · {{ selected.phone ?? 'sin teléfono' }}
        </p>
        <p v-else-if="!puedeBuscarPorNombre && term.trim().length > 1" class="mt-1 text-xs text-slate-500">
          Escribe su teléfono completo abajo y la buscamos; si no está, se guarda como nueva.
        </p>
        <p v-else-if="term.trim().length > 1" class="mt-1 text-xs text-slate-500">
          Se guardará como cliente nuevo.
        </p>
      </div>

      <NxInput
        v-if="!selected"
        v-model="phone"
        label="Teléfono (opcional)"
        inputmode="tel"
        :disabled="isPending"
      />

      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input v-model="chargeNow" type="checkbox" :disabled="isPending" />
        Cobrar ahora
      </label>

      <div v-if="chargeNow" class="grid gap-3 sm:grid-cols-2">
        <NxSelect
          v-model="methodId"
          :options="methods ?? []"
          option-label="name"
          option-value="id"
          label="Método de pago"
          :disabled="isPending"
        />
        <NxInput v-model="price" label="Precio cobrado" inputmode="numeric" :disabled="isPending" />
      </div>

      <p v-else class="text-xs text-slate-500">
        Queda registrado sin cobrar. Se cobra después desde la agenda.
      </p>

      <p v-if="service && chargeNow" class="text-xs text-slate-500">
        Precio de lista {{ money(service.price) }} · {{ service.duration_min }} min
      </p>

      <SinAvisar v-model="silent" :disabled="isPending" />

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <NxButton variant="secondary" :disabled="isPending" @click="emit('close')"
          >Cancelar</NxButton
        >
        <NxButton :loading="isPending" :disabled="!canSubmit" @click="submit">Registrar</NxButton>
      </div>
    </div>
  </NxModal>
</template>
