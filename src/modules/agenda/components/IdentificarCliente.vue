<script setup lang="ts">
import { computed, ref } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'

import {
  useAttachClient,
  useClientLookup,
  useQuickClient,
  type ClientIdentity,
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
| NO ABRE LA BASE. Se busca por teléfono completo, de a una, y la respuesta es
| un nombre de pila con la inicial. Quien atiende puede confirmar "¿Laura B.?"
| y no puede recorrer ni copiar la lista.
*/

const props = defineProps<{ appointmentId: number }>()
const emit = defineEmits<{ asociada: [ClientIdentity] }>()

const { mutateAsync: buscar, isPending: buscando } = useClientLookup()
const { mutateAsync: crear, isPending: creando } = useQuickClient()
const { mutateAsync: asociar, isPending: asociando } = useAttachClient()

const telefono = ref('')
const nombre = ref('')
const error = ref<string | null>(null)

/** `null` = todavía no se buscó. */
const encontrada = ref<ClientIdentity | null>(null)
const noExiste = ref(false)

const ocupado = computed(() => buscando.value || creando.value || asociando.value)
const puedeBuscar = computed(() => telefono.value.replace(/\D/g, '').length >= 7)

async function buscarla(): Promise<void> {
  error.value = null
  encontrada.value = null
  noExiste.value = false

  try {
    const r = await buscar(telefono.value.trim())

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
        v-model="telefono"
        type="tel"
        inputmode="tel"
        placeholder="Su WhatsApp"
        class="min-h-11 min-w-0 flex-1 rounded-lg border border-amber-300 px-3 text-base text-slate-900"
        :disabled="ocupado"
        @input="alEscribir"
        @keydown.enter.prevent="puedeBuscar && buscarla()"
      />
      <button
        type="button"
        class="min-h-11 shrink-0 rounded-lg bg-amber-600 px-4 text-sm font-medium text-white disabled:opacity-50"
        :disabled="!puedeBuscar || ocupado"
        @click="buscarla"
      >
        {{ buscando ? 'Buscando…' : 'Buscar' }}
      </button>
    </div>

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
      <p class="text-sm text-amber-900">No está registrada. ¿Cómo se llama?</p>
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
