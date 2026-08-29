<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { NxButton, NxInput, NxModal, NxSelect } from '@/ui'

import { useCreateBusiness, PLAN_LABELS, VERTICAL_LABELS } from '../composables/usePlatform'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; created: [] }>()

const { mutateAsync, isPending } = useCreateBusiness()

const VERTICALS = Object.entries(VERTICAL_LABELS).map(([value, label]) => ({ value, label }))
const PLANS = Object.entries(PLAN_LABELS).map(([value, label]) => ({ value, label }))

const name = ref('')
const vertical = ref('spa_unas')
const plan = ref('pro')
const timezone = ref('America/Bogota')
const phone = ref('')
const ownerName = ref('')
const ownerEmail = ref('')
const ownerPassword = ref('')
const error = ref<string | null>(null)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      return
    }

    name.value = ''
    vertical.value = 'spa_unas'
    plan.value = 'pro'
    timezone.value = 'America/Bogota'
    phone.value = ''
    ownerName.value = ''
    ownerEmail.value = ''
    ownerPassword.value = ''
    error.value = null
  },
)

const canSubmit = computed(
  () =>
    name.value.trim().length > 1 &&
    ownerName.value.trim().length > 1 &&
    ownerEmail.value.trim().length > 3 &&
    ownerPassword.value.length >= 8 &&
    !isPending.value,
)

async function submit(): Promise<void> {
  error.value = null

  try {
    await mutateAsync({
      name: name.value.trim(),
      vertical: vertical.value,
      subscription_plan: plan.value,
      timezone: timezone.value,
      phone: phone.value.trim() || null,
      owner_name: ownerName.value.trim(),
      owner_email: ownerEmail.value.trim(),
      owner_password: ownerPassword.value,
    })
    emit('created')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos crear el negocio.')
  }
}
</script>

<template>
  <NxModal :model-value="open" title="Nuevo negocio" @update:model-value="emit('close')">
    <div class="flex flex-col gap-4">
      <NxInput v-model="name" label="Nombre del negocio" required :disabled="isPending" />

      <div class="grid gap-3 sm:grid-cols-2">
        <NxSelect
          v-model="vertical"
          :options="VERTICALS"
          option-label="label"
          option-value="value"
          label="Vertical"
          :disabled="isPending"
        />
        <NxSelect
          v-model="plan"
          :options="PLANS"
          option-label="label"
          option-value="value"
          label="Plan"
          :disabled="isPending"
        />
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <NxInput v-model="timezone" label="Zona horaria" :disabled="isPending" />
        <NxInput v-model="phone" label="Teléfono" inputmode="tel" :disabled="isPending" />
      </div>

      <!-- El dueño se crea junto con el negocio. Un negocio sin nadie que
           pueda entrar no sirve, y limpiarlo después es a mano. -->
      <div class="rounded-md border border-slate-200 p-3">
        <p class="mb-3 text-sm font-medium text-slate-700">Dueño del negocio</p>

        <div class="flex flex-col gap-3">
          <NxInput v-model="ownerName" label="Nombre" required :disabled="isPending" />
          <div class="grid gap-3 sm:grid-cols-2">
            <NxInput v-model="ownerEmail" type="email" label="Correo" required :disabled="isPending" />
            <NxInput
              v-model="ownerPassword"
              type="password"
              label="Contraseña"
              required
              :disabled="isPending"
            />
          </div>
        </div>

        <p class="mt-2 text-xs text-slate-500">
          Entra con estos datos y ya puede crear sus servicios y su equipo.
        </p>
      </div>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <NxButton variant="secondary" :disabled="isPending" @click="emit('close')">Cancelar</NxButton>
        <NxButton :loading="isPending" :disabled="!canSubmit" @click="submit">Crear negocio</NxButton>
      </div>
    </div>
  </NxModal>
</template>
