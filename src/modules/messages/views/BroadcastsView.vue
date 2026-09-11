<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput } from '@/ui'

import {
  useBroadcastPreview,
  useBroadcasts,
  useCancelBroadcast,
  useSaveBroadcast,
  useSendBroadcast,
  type Broadcast,
} from '../composables/useBroadcasts'

/*
|------------------------------------------------------------------------------
| Difusiones: la misma promoción a mucha gente
|------------------------------------------------------------------------------
| Existían sólo en el API. Sin pantalla, los filtros de público no tenían desde
| dónde usarse: se podía construir "a las que vienen mucho" y nadie podía
| pedirlo.
|
| Lo que manda acá es SABER A CUÁNTAS LES LLEGA antes de mandar. Una promoción
| que sale a 700 personas cuando se creía que iban 40 no se puede deshacer, y
| en WhatsApp además se paga por mensaje.
*/

const { notify } = useSystemAlert()

const { data, isLoading } = useBroadcasts()
const { mutateAsync: guardar, isPending: guardando } = useSaveBroadcast()
const { mutateAsync: enviar, isPending: enviando } = useSendBroadcast()
const { mutateAsync: cancelar } = useCancelBroadcast()

const difusiones = computed(() => data.value?.data ?? [])
const mandaSola = computed(() => data.value?.sends_by_itself ?? false)

const editando = ref<Broadcast | null>(null)
const creando = ref(false)

const nombre = ref('')
const cuerpo = ref('')
const plantilla = ref('')
const programadaPara = ref('')
const minVisitas = ref<number | null>(null)
const maxVisitas = ref<number | null>(null)
const sinVenirDesde = ref('')
const error = ref<string | null>(null)

/** La difusión cuyo público se está mirando. */
const mirando = ref<number | null>(null)
const { data: publico, isFetching: contando } = useBroadcastPreview(mirando)

function nueva(): void {
  editando.value = null
  creando.value = true
  nombre.value = ''
  cuerpo.value = 'Hola {nombre}, '
  plantilla.value = ''
  programadaPara.value = ''
  minVisitas.value = null
  maxVisitas.value = null
  sinVenirDesde.value = ''
  error.value = null
}

function editar(b: Broadcast): void {
  editando.value = b
  creando.value = true
  nombre.value = b.name
  cuerpo.value = b.body_template
  plantilla.value = b.template_name ?? ''
  programadaPara.value = b.scheduled_at?.slice(0, 16) ?? ''
  minVisitas.value = b.audience?.min_visits ?? null
  maxVisitas.value = b.audience?.max_visits ?? null
  sinVenirDesde.value = b.audience?.not_visited_since ?? ''
  error.value = null
}

/*
 * Atajos, no una calculadora de filtros.
 *
 * Las dos campañas que un salón de verdad manda son "premiar a la fiel" y
 * "traer de vuelta a la que se enfrió". Dárselas armadas evita que alguien
 * tenga que deducir que "vino una vez" es `max_visits = 1`.
 */
const ATAJOS = [
  { label: 'A las frecuentes', min: 5, max: null, sinVenir: '' },
  { label: 'A las que vinieron una sola vez', min: null, max: 1, sinVenir: '' },
  { label: 'A las que no vienen hace 3 meses', min: 1, max: null, sinVenir: 'hace90' },
] as const

function aplicarAtajo(a: (typeof ATAJOS)[number]): void {
  minVisitas.value = a.min
  maxVisitas.value = a.max

  if (a.sinVenir === 'hace90') {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    sinVenirDesde.value = d.toISOString().slice(0, 10)
  } else {
    sinVenirDesde.value = ''
  }
}

async function submit(): Promise<void> {
  error.value = null

  try {
    const { id } = await guardar({
      id: editando.value?.id,
      payload: {
        name: nombre.value.trim(),
        template_name: plantilla.value.trim() || 'promo',
        body_template: cuerpo.value.trim(),
        scheduled_at: programadaPara.value || null,
        audience: {
          min_visits: minVisitas.value,
          max_visits: maxVisitas.value,
          not_visited_since: sinVenirDesde.value || null,
        },
      },
    })

    creando.value = false
    // Se abre el conteo de una: lo primero que hay que ver es a cuántas les
    // llegaría.
    mirando.value = id
    notify('Difusión guardada. Revisa a cuántas le llega antes de mandarla.', 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar la difusión.')
  }
}

async function mandar(b: Broadcast): Promise<void> {
  const cuantas = publico.value?.count

  const pregunta =
    mirando.value === b.id && cuantas !== undefined
      ? `¿Mandar "${b.name}" a ${cuantas} persona(s)? No se puede deshacer.`
      : `¿Mandar "${b.name}"? Revisa antes a cuántas le llega.`

  if (!window.confirm(pregunta)) return

  try {
    const { recipients } = await enviar(b.id)
    notify(`Preparados ${recipients} mensaje(s).`, 'success')
  } catch (e) {
    notify(extractErrorMessage(e, 'No pudimos mandarla.'), 'error')
  }
}

watch(creando, (abierto) => {
  if (abierto) mirando.value = null
})
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Difusiones</h1>
        <p class="mt-1 text-sm text-slate-500">
          La misma promoción a muchas clientas, por WhatsApp.
        </p>
      </div>

      <NxButton @click="nueva">Nueva difusión</NxButton>
    </header>

    <!-- Si el negocio no tiene canal, los mensajes quedan en la bandeja para
         mandarlos a mano. Decirlo antes evita la sorpresa de que "no llegó". -->
    <p
      v-if="!mandaSola"
      class="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Todavía no hay WhatsApp conectado: los mensajes quedan listos en
      <b>Mensajes</b> para enviarlos a mano.
    </p>

    <!-- Formulario -->
    <div
      v-if="creando"
      class="mb-6 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <NxInput v-model="nombre" label="Nombre (para ti)" :disabled="guardando" />

      <label class="text-sm font-medium text-slate-700">
        Mensaje
        <textarea
          v-model="cuerpo"
          rows="3"
          class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900"
          :disabled="guardando"
        />
        <span class="mt-1 block text-xs font-normal text-slate-500">
          <code>{nombre}</code> se reemplaza por el de cada clienta.
        </span>
      </label>

      <div>
        <p class="mb-1.5 text-sm font-medium text-slate-700">¿A quiénes?</p>

        <div class="mb-2 flex flex-wrap gap-2">
          <button
            v-for="a in ATAJOS"
            :key="a.label"
            type="button"
            class="min-h-9 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-600 active:bg-slate-50"
            @click="aplicarAtajo(a)"
          >
            {{ a.label }}
          </button>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <label class="text-xs text-slate-600">
            Desde cuántas visitas
            <input
              v-model.number="minVisitas"
              type="number"
              min="1"
              class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base text-slate-900"
              :disabled="guardando"
            />
          </label>

          <label class="text-xs text-slate-600">
            Hasta cuántas
            <input
              v-model.number="maxVisitas"
              type="number"
              min="0"
              class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base text-slate-900"
              :disabled="guardando"
            />
          </label>

          <label class="text-xs text-slate-600">
            Que no vengan desde
            <input
              v-model="sinVenirDesde"
              type="date"
              class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base text-slate-900"
              :disabled="guardando"
            />
          </label>
        </div>
      </div>

      <label class="text-sm font-medium text-slate-700">
        Programar para (opcional)
        <input
          v-model="programadaPara"
          type="datetime-local"
          class="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base text-slate-900"
          :disabled="guardando"
        />
      </label>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <NxButton variant="ghost" :disabled="guardando" @click="creando = false">Cancelar</NxButton>
        <NxButton
          :loading="guardando"
          :disabled="!nombre.trim() || !cuerpo.trim() || guardando"
          @click="submit"
        >
          Guardar
        </NxButton>
      </div>
    </div>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p
      v-else-if="!difusiones.length"
      class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600"
    >
      Todavía no has creado ninguna difusión.
    </p>

    <div v-else class="flex flex-col gap-3">
      <article
        v-for="b in difusiones"
        :key="b.id"
        class="rounded-lg border border-slate-200 bg-white p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-medium text-slate-800">{{ b.name }}</p>
            <p class="text-xs text-slate-500">
              {{ b.status_label }}
              <span v-if="b.recipients"> · {{ b.recipients }} destinatarias</span>
              <span v-if="b.scheduled_at"> · programada</span>
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <NxButton variant="outline" size="sm" @click="mirando = b.id">
              ¿A cuántas le llega?
            </NxButton>
            <NxButton v-if="b.editable" variant="ghost" size="sm" @click="editar(b)">
              Editar
            </NxButton>
            <NxButton v-if="b.editable" size="sm" :loading="enviando" @click="mandar(b)">
              Mandar
            </NxButton>
            <NxButton v-if="b.editable" variant="ghost" size="sm" @click="cancelar(b.id)">
              Cancelar
            </NxButton>
          </div>
        </div>

        <p class="mt-2 whitespace-pre-line text-sm text-slate-600">{{ b.body_template }}</p>

        <!-- El conteo, con nombres. Un número solo no deja comprobar que el
             filtro hace lo que uno cree; tres nombres, sí. -->
        <div v-if="mirando === b.id" class="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
          <p v-if="contando" class="text-slate-500">Contando…</p>
          <template v-else-if="publico">
            <p class="font-medium text-slate-800">
              Le llega a {{ publico.count }}
              {{ publico.count === 1 ? 'clienta' : 'clientas' }}
            </p>
            <p v-if="publico.sample.length" class="mt-1 text-xs text-slate-500">
              Por ejemplo: {{ publico.sample.map((s) => s.nombre).join(', ') }}
            </p>
            <p v-else class="mt-1 text-xs text-amber-700">
              Ninguna cumple esos filtros. Revisa el público antes de mandarla.
            </p>
          </template>
        </div>
      </article>
    </div>
  </section>
</template>
