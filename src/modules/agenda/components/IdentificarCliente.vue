<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'

import {
  searchClients,
  useAttachClient,
  useClientLookup,
  useQuickClient,
  type ClientIdentity,
  type ClientOption,
} from '../composables/useAppointments'

/*
|------------------------------------------------------------------------------
| "¿Quién es?" — al cobrar, que es cuando la clienta está delante
|------------------------------------------------------------------------------
| De 3.331 visitas cobradas, 2.112 se cobraron sin ficha: el 63%. Cada una se
| perdió su sello, su encuesta y su historial. Por eso hay exactamente 1.219
| sellos — las 1.219 visitas que sí la tienen.
|
| No es que faltara código: es que nadie pedía el nombre, y ni la app vieja ni
| esta lo reclamaban. El sistema viejo al menos lo anotaba en un log que nadie
| leía (674 fallos, 45 al mes, todavía ocurriendo).
|
| Va acá y no en la ficha de la clienta porque este es el único momento en que
| alguien del local la tiene enfrente y le puede preguntar el número.
|
| Por NOMBRE o por TELÉFONO, en un solo campo (27-sep: las manicuristas buscan
| por los dos). Por nombre salen hasta 20 con el teléfono enmascarado
| (··· 2233): alcanza para distinguir a dos Carolinas, no para llevarse la
| lista. Un teléfono completo se pregunta de a una, como antes.
*/

const props = defineProps<{ appointmentId: number }>()
const emit = defineEmits<{ asociada: [ClientIdentity] }>()

const { mutateAsync: buscar, isPending: buscando } = useClientLookup()
const { mutateAsync: crear, isPending: creando } = useQuickClient()
const { mutateAsync: asociar, isPending: asociando } = useAttachClient()

/** Lo que se escribe: un nombre o un WhatsApp. */
const termino = ref('')
const telefono = ref('')
const nombre = ref('')
const resultados = ref<ClientOption[]>([])
const error = ref<string | null>(null)

/** `null` = todavía no se buscó. */
const encontrada = ref<ClientIdentity | null>(null)
const noExiste = ref(false)

const ocupado = computed(() => buscando.value || creando.value || asociando.value)
/** Si lo escrito es un número (7+ dígitos y nada más que dígitos, espacios o +). */
const esTelefono = computed(
  () => /^[\d\s+()-]+$/.test(termino.value) && termino.value.replace(/\D/g, '').length >= 7,
)
const puedeBuscar = computed(() => esTelefono.value)

let espera: ReturnType<typeof setTimeout> | undefined

// Por nombre, mientras escribe: la lista aparece sola.
watch(termino, (valor) => {
  clearTimeout(espera)
  resultados.value = []

  if (esTelefono.value || valor.trim().length < 2) return

  espera = setTimeout(async () => {
    try {
      resultados.value = await searchClients(valor)
    } catch {
      resultados.value = []
    }
  }, 250)
})

/** Crear la ficha cuando no aparece: con lo que ya se escribió prellenado. */
function crearNueva(): void {
  resultados.value = []
  encontrada.value = null
  noExiste.value = true
  if (esTelefono.value) telefono.value = termino.value.trim()
  else nombre.value = termino.value.trim()
}

async function buscarla(): Promise<void> {
  error.value = null
  encontrada.value = null
  noExiste.value = false

  telefono.value = termino.value.trim()

  try {
    const r = await buscar(telefono.value)

    if (r.found && r.client) {
      encontrada.value = r.client
    } else {
      noExiste.value = true
    }
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos buscarla.')
  }
}

async function usar(cliente: ClientIdentity): Promise<void> {
  error.value = null

  try {
    await asociar({ appointmentId: props.appointmentId, clientId: cliente.id })
    emit('asociada', cliente)
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos asociarla a esta cita.')
  }
}

async function crearla(): Promise<void> {
  error.value = null

  try {
    await usar(await crear({ name: nombre.value.trim(), phone: telefono.value.trim() }))
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos crear la ficha.')
  }
}

/*
 * Cambiar el número borra lo encontrado.
 *
 * Sin esto, buscar un número, equivocarse y corregirlo dejaba en pantalla el
 * nombre del anterior — y asociar a la persona equivocada es peor que no
 * asociar a nadie.
 */
function alEscribir(): void {
  encontrada.value = null
  noExiste.value = false
}
</script>

<template>
  <div class="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
    <p class="text-sm font-medium text-amber-900">¿Quién es?</p>
    <!-- El porqué, en una línea. Sin esto parece un campo opcional más y se
         salta: es justo lo que viene pasando en 2 de cada 3 visitas. -->
    <p class="mt-0.5 text-xs text-amber-800">
      Sin ficha, esta visita no suma sello ni recibe la encuesta.
    </p>

    <div class="mt-2 flex gap-2">
      <input
        v-model="termino"
        type="text"
        autocomplete="off"
        placeholder="Nombre o WhatsApp"
        class="min-h-11 min-w-0 flex-1 rounded-lg border border-amber-300 px-3 text-base text-slate-900"
        :disabled="ocupado"
        @input="alEscribir"
        @keydown.enter.prevent="puedeBuscar && buscarla()"
      />
      <button
        v-if="esTelefono"
        type="button"
        class="min-h-11 shrink-0 rounded-lg bg-amber-600 px-4 text-sm font-medium text-white disabled:opacity-50"
        :disabled="!puedeBuscar || ocupado"
        @click="buscarla"
      >
        {{ buscando ? 'Buscando…' : 'Buscar' }}
      </button>
    </div>

    <!-- Por nombre: las que coinciden, con el teléfono enmascarado si no se
         tiene permiso de ver la base. Tocar una la asocia. -->
    <ul
      v-if="resultados.length"
      class="mt-2 divide-y divide-amber-100 overflow-hidden rounded-lg border border-amber-200 bg-white"
    >
      <li v-for="c in resultados" :key="c.id">
        <button
          type="button"
          class="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm text-slate-800 hover:bg-amber-50 disabled:opacity-50"
          :disabled="ocupado"
          @click="usar({ id: c.id, display_name: c.full_name })"
        >
          <span class="min-w-0 truncate">{{ c.full_name }}</span>
          <span v-if="c.phone" class="shrink-0 text-xs tabular-nums text-slate-500">{{
            c.phone
          }}</span>
        </button>
      </li>
    </ul>
    <button
      v-if="termino.trim().length > 1 && !encontrada && !noExiste"
      type="button"
      class="mt-2 text-xs text-amber-800 underline"
      :disabled="ocupado"
      @click="crearNueva"
    >
      No aparece: crear su ficha
    </button>

    <!-- Ya estaba registrada. Se confirma con el nombre y se asocia. -->
    <div v-if="encontrada" class="mt-2 flex items-center gap-2">
      <p class="min-w-0 flex-1 text-sm text-amber-900">
        Es <b>{{ encontrada.display_name }}</b
        >, ya registrada.
      </p>
      <button
        type="button"
        class="min-h-11 shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        :disabled="ocupado"
        @click="usar(encontrada)"
      >
        Es ella
      </button>
    </div>

    <!-- No estaba. Se crea con lo mínimo y queda asociada de una. -->
    <div v-else-if="noExiste" class="mt-2">
      <p class="text-sm text-amber-900">No está registrada. Créale la ficha:</p>
      <input
        v-model="telefono"
        type="tel"
        inputmode="tel"
        placeholder="Su WhatsApp"
        class="mt-1 min-h-11 w-full rounded-lg border border-amber-300 px-3 text-base text-slate-900"
        :disabled="ocupado"
      />
      <div class="mt-1 flex gap-2">
        <input
          v-model="nombre"
          type="text"
          autocapitalize="words"
          placeholder="Su nombre"
          class="min-h-11 min-w-0 flex-1 rounded-lg border border-amber-300 px-3 text-base text-slate-900"
          :disabled="ocupado"
          @keydown.enter.prevent="nombre.trim().length > 1 && crearla()"
        />
        <button
          type="button"
          class="min-h-11 shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          :disabled="nombre.trim().length < 2 || ocupado"
          @click="crearla"
        >
          Crear
        </button>
      </div>
    </div>

    <p v-if="error" class="mt-2 text-xs text-red-700">{{ error }}</p>
  </div>
</template>
