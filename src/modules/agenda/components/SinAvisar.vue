<script setup lang="ts">
/*
 * «No avisar a nadie», para el trabajo de oficina.
 *
 * Subir lo que se hizo ayer y nadie cargó, cobrar a medianoche un servicio de
 * la tarde, corregir una cita: la acción se hace igual, pero ni la clienta ni
 * el equipo reciben mensaje. Solo lo ve quien tiene el permiso (el admin):
 * callar un aviso es decidir que la clienta no se entere.
 */
import { useAuthStore } from '@/stores/auth.store'
import { NxSwitch } from '@/ui'

defineProps<{ modelValue: boolean; disabled?: boolean }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()

const auth = useAuthStore()
</script>

<template>
  <label
    v-if="auth.can('avisos.silenciar')"
    class="flex items-start gap-3 rounded-md border px-3 py-2 text-sm"
    :class="modelValue ? 'border-amber-300 bg-amber-50' : 'border-slate-200'"
  >
    <NxSwitch
      :model-value="modelValue"
      :disabled="disabled"
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <span>
      <span class="block font-medium text-slate-800">No avisar a nadie</span>
      <span class="block text-xs text-slate-500">
        Ni a la clienta ni al equipo. Para subir lo de otro día o corregir.
      </span>
    </span>
  </label>
</template>
