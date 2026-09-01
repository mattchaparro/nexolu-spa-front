<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxModal, NxSelect } from '@/ui'

import { useLocations } from '@/modules/settings/composables/useLocations'

import { useSaveResource, type TeamResource } from '../composables/useCatalog'

const props = defineProps<{
  resource: TeamResource | null
  open: boolean
  /** El plan ya no da para más gente. Los espacios sí se pueden seguir agregando. */
  cupoLleno?: boolean
  limiteEquipo?: number | null
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { mutateAsync, isPending } = useSaveResource()

const TYPES = [
  { value: 'staff', label: 'Persona del equipo' },
  { value: 'station', label: 'Puesto o silla' },
  { value: 'room', label: 'Cabina o sala' },
  { value: 'equipment', label: 'Equipo' },
]

const ROLES = [
  { value: 'staff', label: 'Del equipo — ve y atiende lo suyo' },
  { value: 'reception', label: 'Recepción — agenda para todo el equipo y cobra' },
  { value: 'admin', label: 'Administrador — acceso completo' },
]

const type = ref('staff')
const locationId = ref<number | null>(null)
const name = ref('')
const lastName = ref('')
const color = ref('#4f46e5')
const email = ref('')
const password = ref('')
const phone = ref('')
const role = ref('staff')
const commission = ref('')
const photo = ref<File | null>(null)
const preview = ref<string | null>(null)
const error = ref<string | null>(null)

/** Una cita que impide trasladar a esa persona de sede. */
interface Bloqueante {
  appointment_id: number
  date: string | null
  time: string | null
  client_name: string | null
  service_name: string | null
}

const bloqueantes = ref<Bloqueante[]>([])

const isEditing = computed(() => props.resource !== null)
/** Sólo las personas llevan cuenta para entrar. Una cabina se ocupa, no entra. */
const isPerson = computed(() => type.value === 'staff')

const { data: locationsData } = useLocations()

const sedes = computed(() => (locationsData.value?.locations ?? []).filter((l) => l.is_active))
/** Con un solo local no hay nada que elegir: el servidor lo pone en la principal. */
const variasSedes = computed(() => sedes.value.length > 1)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return
    }

    const r = props.resource
    type.value = r?.type ?? 'staff'
    // Al agregar cae en la principal; al editar, en la suya. Nunca en null
    // para el negocio de varias sedes: un recurso sin sede desaparece del
    // filtro de la agenda sin explicación.
    locationId.value =
      r?.location_id ?? sedes.value.find((l) => l.is_primary)?.id ?? sedes.value[0]?.id ?? null
    name.value = r?.name ?? ''
    lastName.value = ''
    color.value = r?.color ?? '#4f46e5'
    email.value = ''
    password.value = ''
    phone.value = ''
    role.value = 'staff'
    // El formulario habla en porcentaje (50); la API guarda fracción (0.50).
    commission.value = r?.commission_rate != null ? String(Math.round(r.commission_rate * 100)) : ''
    photo.value = null
    preview.value = r?.photo_url ?? null
    error.value = null
    bloqueantes.value = []
  },
)

function onFile(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  photo.value = file
  preview.value = file ? URL.createObjectURL(file) : (props.resource?.photo_url ?? null)
}

async function submit(): Promise<void> {
  error.value = null
  bloqueantes.value = []

  // Vacío = sin porcentaje propio, que NO es lo mismo que 0. Se manda null
  // explícito para poder quitárselo a alguien que ya lo tenía.
  const commissionRate =
    isPerson.value && commission.value.trim() !== '' ? Number(commission.value) / 100 : null

  const payload: Record<string, unknown> = isEditing.value
    ? {
        name: name.value.trim(),
        color: color.value,
        commission_rate: commissionRate,
        // Sólo se manda si de verdad cambió: el servidor rechaza el traslado
        // de quien tiene citas pendientes, y no tiene sentido arriesgar ese
        // 422 en un cambio de nombre.
        ...(variasSedes.value && locationId.value !== props.resource?.location_id
          ? { location_id: locationId.value }
          : {}),
      }
    : {
        type: type.value,
        ...(variasSedes.value && locationId.value ? { location_id: locationId.value } : {}),
        name: name.value.trim(),
        last_name: lastName.value.trim() || null,
        color: color.value,
        commission_rate: commissionRate,
        ...(isPerson.value && email.value.trim()
          ? {
              email: email.value.trim(),
              password: password.value,
              phone: phone.value.trim() || null,
              role: role.value,
            }
          : {}),
      }

  try {
    await mutateAsync({ id: props.resource?.id, payload, photo: photo.value })
    emit('saved')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar.')

    /*
     * Las citas que impiden el traslado, si el rechazo vino por eso.
     *
     * Un "no puedes" a secas obliga a ir a buscarlas a la agenda día por día,
     * sin saber cuántas faltan. El servidor ya sabe cuáles son; mostrarlas es
     * la diferencia entre un muro y una lista de pendientes.
     */
    bloqueantes.value =
      (e as { response?: { data?: { blocking?: Bloqueante[] } } })?.response?.data?.blocking ?? []
  }
}
</script>

<template>
  <NxModal
    :model-value="open"
    :title="isEditing ? 'Editar' : 'Agregar al equipo'"
    @update:model-value="emit('close')"
  >
    <div class="flex flex-col gap-4">
      <template v-if="!isEditing">
        <NxSelect
          v-model="type"
          :options="TYPES"
          option-label="label"
          option-value="value"
          label="Tipo"
          :disabled="isPending"
        />

        <!-- El tope se avisa acá, donde se elige el tipo, y no en el botón de
             la lista: una cabina o una silla no gastan cupo de plan. -->
        <p
          v-if="cupoLleno && isPerson"
          class="-mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          Tu plan permite {{ limiteEquipo }} personas activas y ya las tienes. Desactiva a alguien
          para liberar un cupo, o escríbenos para ampliar el plan. Los puestos y cabinas no gastan
          cupo.
        </p>
      </template>

      <!-- En qué local trabaja. Sólo con más de una sede: con una sola, el
           servidor la pone en la principal y preguntarlo sería ruido. -->
      <div v-if="variasSedes">
        <NxSelect
          v-model="locationId"
          :options="sedes"
          option-label="name"
          option-value="id"
          label="Sede"
          :disabled="isPending"
        />
        <p v-if="isEditing" class="mt-1 text-xs text-slate-500">
          Para trasladarla no puede tener citas pendientes: si las tiene, reagéndalas primero para
          que ningún cliente llegue al local equivocado.
        </p>
      </div>

      <div class="grid gap-3" :class="isEditing ? '' : 'sm:grid-cols-2'">
        <NxInput v-model="name" label="Nombre" required :disabled="isPending" />
        <NxInput v-if="!isEditing" v-model="lastName" label="Apellido" :disabled="isPending" />
      </div>

      <div class="flex items-center gap-3">
        <label class="text-sm text-slate-600">Color en la agenda</label>
        <input
          v-model="color"
          type="color"
          class="h-8 w-14 rounded border border-slate-200"
          :disabled="isPending"
        />
      </div>

      <!-- Su porcentaje general. Es lo que evita tener que ponerle un acuerdo
           servicio por servicio a quien va al 50% en todo -- y acordarse de
           repetirlo cada vez que entra un servicio nuevo al catálogo, que es
           justo cuando nadie se acuerda. -->
      <div v-if="isPerson">
        <NxInput
          v-model="commission"
          label="Comisión (%)"
          inputmode="numeric"
          placeholder="Sin porcentaje propio"
          :disabled="isPending"
        />
        <p class="mt-1 text-xs text-slate-500">
          <template v-if="commission.trim() !== ''">
            Gana <b>{{ commission }}%</b> en todos los servicios, aunque cada uno tenga otro. Se
            puede pactar algo distinto en un servicio puntual.
          </template>
          <template v-else>
            Si lo dejas vacío, cada servicio decide con su propio porcentaje (o el de su categoría).
          </template>
        </p>
      </div>

      <div>
        <label class="mb-1 block text-sm text-slate-600">Foto</label>
        <div class="flex items-center gap-3">
          <img
            v-if="preview"
            :src="preview"
            alt=""
            class="h-14 w-14 rounded-full object-cover ring-1 ring-slate-200"
          />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
            :disabled="isPending"
            @change="onFile"
          />
        </div>
      </div>

      <!-- La cuenta se crea junto con la persona. Separarlo es como se
           terminan teniendo gente en la agenda que no puede entrar. -->
      <div v-if="!isEditing && isPerson" class="rounded-md border border-slate-200 p-3">
        <p class="mb-3 text-sm font-medium text-slate-700">Acceso al sistema (opcional)</p>

        <div class="flex flex-col gap-3">
          <NxInput v-model="email" type="email" label="Correo" :disabled="isPending" />
          <div class="grid gap-3 sm:grid-cols-2">
            <NxInput
              v-model="password"
              type="password"
              label="Contraseña"
              :disabled="isPending || !email.trim()"
            />
            <NxInput v-model="phone" label="Teléfono" inputmode="tel" :disabled="isPending" />
          </div>
          <NxSelect
            v-model="role"
            :options="ROLES"
            option-label="label"
            option-value="value"
            label="Puede hacer"
            :disabled="isPending || !email.trim()"
          />
        </div>

        <p class="mt-2 text-xs text-slate-500">
          Sin correo, la persona aparece en la agenda pero no entra al sistema.
        </p>
      </div>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <!-- Las citas que impiden el traslado. Sin la lista hay que ir a
           buscarlas a la agenda día por día, sin saber cuántas faltan. -->
      <div v-if="bloqueantes.length" class="rounded-md border border-red-200 bg-red-50 px-3 py-2">
        <p class="text-xs font-medium uppercase tracking-wide text-red-700">Citas pendientes</p>
        <ul class="mt-1 space-y-0.5 text-sm text-red-900">
          <li v-for="cita in bloqueantes" :key="cita.appointment_id">
            {{ cita.date }} {{ cita.time }} · {{ cita.client_name ?? 'Sin nombre' }}
            <span class="text-red-700">— {{ cita.service_name }}</span>
          </li>
        </ul>
      </div>

      <div class="flex justify-end gap-2">
        <NxButton variant="secondary" :disabled="isPending" @click="emit('close')"
          >Cancelar</NxButton
        >
        <NxButton
          :loading="isPending"
          :disabled="!name.trim() || (!isEditing && isPerson && cupoLleno)"
          @click="submit"
        >
          Guardar
        </NxButton>
      </div>
    </div>
  </NxModal>
</template>
