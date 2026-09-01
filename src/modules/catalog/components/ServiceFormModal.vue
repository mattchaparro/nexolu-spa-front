<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxModal, NxSwitch } from '@/ui'

import {
  useSaveService,
  useTeam,
  type AdminService,
  type ServiceAssignment,
} from '../composables/useCatalog'

const props = defineProps<{ service: AdminService | null; open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { data: team } = useTeam()
const { mutateAsync, isPending } = useSaveService()

const name = ref('')
const description = ref('')
const duration = ref('45')
const bufferBefore = ref('0')
const bufferAfter = ref('0')
const price = ref('0')
const commission = ref('30')
const bookableOnline = ref(true)
const image = ref<File | null>(null)
const preview = ref<string | null>(null)
const error = ref<string | null>(null)

/** Quién presta el servicio, con su duración y porcentaje propios. */
const assignments = ref<Map<number, { duration: string; commission: string }>>(new Map())

const staff = computed(() => team.value?.filter((r) => r.type === 'staff' && r.is_active) ?? [])

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return
    }

    const s = props.service
    name.value = s?.name ?? ''
    description.value = s?.description ?? ''
    duration.value = String(s?.duration_min ?? 45)
    bufferBefore.value = String(s?.buffer_before_min ?? 0)
    bufferAfter.value = String(s?.buffer_after_min ?? 0)
    price.value = String(s?.price ?? 0)
    commission.value = '30'
    bookableOnline.value = s?.is_bookable_online ?? true
    image.value = null
    preview.value = s?.image_url ?? null
    error.value = null

    assignments.value = new Map(
      (s?.resource_ids ?? []).map((id) => [id, { duration: '', commission: '' }]),
    )
  },
)

function toggle(resourceId: number): void {
  const next = new Map(assignments.value)

  if (next.has(resourceId)) {
    next.delete(resourceId)
  } else {
    next.set(resourceId, { duration: '', commission: '' })
  }

  assignments.value = next
}

function onFile(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  image.value = file
  preview.value = file ? URL.createObjectURL(file) : (props.service?.image_url ?? null)
}

/** Lo que el recurso queda ocupado, que es lo que el cliente no ve. */
const occupied = computed(
  () =>
    Number(duration.value || 0) + Number(bufferBefore.value || 0) + Number(bufferAfter.value || 0),
)

async function submit(): Promise<void> {
  error.value = null

  const resources: ServiceAssignment[] = [...assignments.value.entries()].map(
    ([id, overrides]) => ({
      resource_id: id,
      duration_override_min: overrides.duration ? Number(overrides.duration) : null,
      // El formulario pide porcentaje (40); la API guarda fracción (0.40).
      commission_rate_override: overrides.commission ? Number(overrides.commission) / 100 : null,
    }),
  )

  try {
    await mutateAsync({
      id: props.service?.id,
      payload: {
        name: name.value.trim(),
        description: description.value.trim() || null,
        duration_min: Number(duration.value),
        buffer_before_min: Number(bufferBefore.value || 0),
        buffer_after_min: Number(bufferAfter.value || 0),
        price: Number(price.value),
        commission_rate: Number(commission.value) / 100,
        is_bookable_online: bookableOnline.value,
        resources,
      },
      image: image.value,
    })
    emit('saved')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar el servicio.')
  }
}
</script>

<template>
  <NxModal
    :model-value="open"
    :title="service ? 'Editar servicio' : 'Nuevo servicio'"
    size="lg"
    @update:model-value="emit('close')"
  >
    <div class="flex flex-col gap-4">
      <NxInput v-model="name" label="Nombre" required :disabled="isPending" />
      <NxInput v-model="description" label="Descripción (opcional)" :disabled="isPending" />

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NxInput
          v-model="duration"
          label="Duración (min)"
          inputmode="numeric"
          :disabled="isPending"
        />
        <NxInput v-model="price" label="Precio" inputmode="numeric" :disabled="isPending" />
        <NxInput
          v-model="bufferBefore"
          label="Preparación"
          inputmode="numeric"
          :disabled="isPending"
        />
        <NxInput v-model="bufferAfter" label="Limpieza" inputmode="numeric" :disabled="isPending" />
      </div>

      <p class="-mt-2 text-xs text-slate-500">
        El cliente ve <b>{{ duration || 0 }} min</b>; el puesto queda ocupado
        <b>{{ occupied }} min</b>. La preparación y la limpieza no se cobran.
      </p>

      <div class="grid grid-cols-2 gap-3">
        <NxInput
          v-model="commission"
          label="Comisión (%)"
          inputmode="numeric"
          :disabled="isPending"
        />
        <div class="flex items-end pb-2">
          <NxSwitch v-model="bookableOnline" :disabled="isPending" />
          <span class="ml-2 text-sm text-slate-600">Reservable en línea</span>
        </div>
      </div>

      <div>
        <label class="mb-1 block text-sm text-slate-600">Imagen</label>
        <div class="flex items-center gap-3">
          <img
            v-if="preview"
            :src="preview"
            alt=""
            class="h-16 w-16 rounded-md object-cover ring-1 ring-slate-200"
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

      <!-- Quién lo presta. No todos hacen todo, y algunos
           tardan distinto o cobran otro porcentaje en el mismo servicio. -->
      <div>
        <p class="mb-2 text-sm font-medium text-slate-700">¿Quién lo presta?</p>

        <p v-if="!staff.length" class="text-sm text-slate-500">
          Todavía no hay nadie en el equipo. Agrégalos en Equipo.
        </p>

        <div v-else class="divide-y divide-slate-100 rounded-md border border-slate-200">
          <div v-for="person in staff" :key="person.id" class="flex items-center gap-3 px-3 py-2">
            <input
              :id="`r-${person.id}`"
              type="checkbox"
              :checked="assignments.has(person.id)"
              :disabled="isPending"
              @change="toggle(person.id)"
            />
            <label :for="`r-${person.id}`" class="flex-1 text-sm text-slate-700">{{
              person.name
            }}</label>

            <template v-if="assignments.has(person.id)">
              <input
                v-model="assignments.get(person.id)!.duration"
                type="text"
                inputmode="numeric"
                :placeholder="`${duration} min`"
                class="w-24 rounded border border-slate-200 px-2 py-1 text-sm"
                :disabled="isPending"
              />
              <input
                v-model="assignments.get(person.id)!.commission"
                type="text"
                inputmode="numeric"
                :placeholder="`${commission}%`"
                class="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                :disabled="isPending"
              />
            </template>
          </div>
        </div>

        <p v-if="staff.length" class="mt-1 text-xs text-slate-500">
          Deja los campos vacíos para usar la duración y la comisión generales.
        </p>
      </div>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <NxButton variant="secondary" :disabled="isPending" @click="emit('close')"
          >Cancelar</NxButton
        >
        <NxButton :loading="isPending" :disabled="!name.trim()" @click="submit">Guardar</NxButton>
      </div>
    </div>
  </NxModal>
</template>
