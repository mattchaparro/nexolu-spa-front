<script setup lang="ts">
// Calcado de Components/PageHeader.vue del legacy. El legacy permitia un
// prop `color` para variar el degradado del icono por pantalla - se
// saca a proposito, mismo motivo que en NxStatCard: sin criterio
// semantico para variar el color, se queda fijo en indigo (marca).
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    icon?: string
    // Version reducida para pantallas densas en informacion (ej. Vender)
    // donde cada pixel vertical cuenta - mismo componente, menos chrome.
    compact?: boolean
  }>(),
  {
    subtitle: undefined,
    icon: undefined,
    compact: false,
  },
)
</script>

<template>
  <div class="flex items-center" :class="compact ? 'gap-2' : 'gap-3'">
    <div
      v-if="icon"
      class="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600"
      :class="compact ? 'h-7 w-7' : 'h-10 w-10'"
    >
      <i :class="[icon, compact ? 'text-sm' : '']" class="text-white" />
    </div>
    <div class="min-w-0">
      <h2
        class="truncate font-semibold leading-tight text-slate-900"
        :class="compact ? 'text-base' : 'text-xl'"
      >
        {{ title }}
      </h2>
      <p v-if="subtitle" class="mt-1 text-sm text-slate-600">{{ subtitle }}</p>
    </div>
  </div>
</template>
