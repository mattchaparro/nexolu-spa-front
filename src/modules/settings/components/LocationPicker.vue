<script setup lang="ts">
import { computed, watch } from 'vue'

import { useLocations } from '../composables/useLocations'

/**
 * El selector de sede que usan las pantallas de dinero.
 *
 * Existe como componente y no copiado en cada pantalla porque las reglas no
 * son obvias y repetirlas cuatro veces es garantizar que una se desincronice:
 *
 * - Con UNA sola sede no se muestra nada. Un selector de una opción es ruido.
 * - `requerido` es para el CIERRE y el TURNO, que ocurren en un cajón concreto:
 *   ahí no existe "todas", y arranca en la sede principal en vez de en vacío.
 * - Sin `requerido` -- reportes, gastos, resumen -- "Todas" sí es una respuesta
 *   legítima, y es la que el dueño de dos locales quiere por defecto.
 */
const props = defineProps<{
  modelValue: number | null
  /** El acto ocurre en un cajón concreto: no existe "todas". */
  requerido?: boolean
  label?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

const { data } = useLocations()

const sedes = computed(() => (data.value?.locations ?? []).filter((l) => l.is_active))

/** Con un solo local no hay nada que elegir. */
const visible = computed(() => sedes.value.length > 1)

watch(
  [sedes, () => props.requerido],
  ([lista, requerido]) => {
    if (lista.length < 2) {
      // Volvió a haber un solo local: sin filtro, como antes de las sedes.
      if (props.modelValue !== null) emit('update:modelValue', null)
      return
    }

    // La sede elegida puede haberse apagado desde otro dispositivo.
    if (props.modelValue !== null && !lista.some((l) => l.id === props.modelValue)) {
      emit('update:modelValue', null)
      return
    }

    // Un cierre necesita un cajón desde el primer render: dejarlo en "todas"
    // muestra un cuadre que después el servidor no deja confirmar.
    if (requerido && props.modelValue === null) {
      emit('update:modelValue', (lista.find((l) => l.is_primary) ?? lista[0]).id)
    }
  },
  { immediate: true },
)

function onChange(event: Event): void {
  const raw = (event.target as HTMLSelectElement).value
  emit('update:modelValue', raw === '' ? null : Number(raw))
}
</script>

<template>
  <label v-if="visible" class="text-sm text-slate-700">
    <span v-if="label" class="mb-1 block">{{ label }}</span>
    <select
      :value="modelValue ?? ''"
      class="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
      aria-label="Sede"
      @change="onChange"
    >
      <!-- "Todas" sólo donde de verdad significa algo. Un cierre que abarque
           dos cajones no se puede cuadrar contra ninguno. -->
      <option v-if="!requerido" value="">Todas las sedes</option>
      <option v-for="sede in sedes" :key="sede.id" :value="sede.id">{{ sede.name }}</option>
    </select>
  </label>
</template>
