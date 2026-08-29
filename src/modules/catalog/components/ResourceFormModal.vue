<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxModal, NxSelect } from '@/ui'

import { useSaveResource, type TeamResource } from '../composables/useCatalog'

const props = defineProps<{ resource: TeamResource | null; open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { mutateAsync, isPending } = useSaveResource()

const TYPES = [
  { value: 'staff', label: 'Profesional' },
  { value: 'station', label: 'Puesto o silla' },
  { value: 'room', label: 'Cabina o sala' },
  { value: 'equipment', label: 'Equipo' },
]

const ROLES = [
  { value: 'staff', label: 'Profesional — ve y atiende lo suyo' },
  { value: 'reception', label: 'Recepción — agenda para todo el equipo y cobra' },
  { value: 'admin', label: 'Administrador — acceso completo' },
]

const type = ref('staff')
const name = ref('')
const lastName = ref('')
const color = ref('#4f46e5')
const email = ref('')
const password = ref('')
const phone = ref('')
const role = ref('staff')
const photo = ref<File | null>(null)
const preview = ref<string | null>(null)
const error = ref<string | null>(null)

const isEditing = computed(() => props.resource !== null)
/** Sólo las personas llevan cuenta para entrar. Una cabina se ocupa, no entra. */
const isPerson = computed(() => type.value === 'staff')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return
    }

    const r = props.resource
    type.value = r?.type ?? 'staff'
    name.value = r?.name ?? ''
    lastName.value = ''
    color.value = r?.color ?? '#4f46e5'
    email.value = ''
    password.value = ''
    phone.value = ''
    role.value = 'staff'
    photo.value = null
    preview.value = r?.photo_url ?? null
    error.value = null
  },
)

function onFile(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  photo.value = file
  preview.value = file ? URL.createObjectURL(file) : (props.resource?.photo_url ?? null)
}

async function submit(): Promise<void> {
  error.value = null

  const payload: Record<string, unknown> = isEditing.value
    ? { name: name.value.trim(), color: color.value }
    : {
        type: type.value,
        name: name.value.trim(),
        last_name: lastName.value.trim() || null,
        color: color.value,
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
      <NxSelect
        v-if="!isEditing"
        v-model="type"
        :options="TYPES"
        option-label="label"
        option-value="value"
        label="Tipo"
        :disabled="isPending"
      />

      <div class="grid gap-3" :class="isEditing ? '' : 'sm:grid-cols-2'">
        <NxInput v-model="name" label="Nombre" required :disabled="isPending" />
        <NxInput v-if="!isEditing" v-model="lastName" label="Apellido" :disabled="isPending" />
      </div>

      <div class="flex items-center gap-3">
        <label class="text-sm text-slate-600">Color en la agenda</label>
        <input v-model="color" type="color" class="h-8 w-14 rounded border border-slate-200" :disabled="isPending" />
      </div>

      <div>
        <label class="mb-1 block text-sm text-slate-600">Foto</label>
        <div class="flex items-center gap-3">
          <img v-if="preview" :src="preview" alt="" class="h-14 w-14 rounded-full object-cover ring-1 ring-slate-200" />
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

      <div class="flex justify-end gap-2">
        <NxButton variant="secondary" :disabled="isPending" @click="emit('close')">Cancelar</NxButton>
        <NxButton :loading="isPending" :disabled="!name.trim()" @click="submit">Guardar</NxButton>
      </div>
    </div>
  </NxModal>
</template>
