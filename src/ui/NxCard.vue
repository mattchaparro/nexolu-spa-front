<script setup lang="ts">
// Sin PrimeVue por dentro a proposito: Card no tiene comportamiento, solo
// estructura visual - envolver el Card de PrimeVue exigiria pasar `pt`
// por cada seccion (header/content/footer) sin ganar nada a cambio.
withDefaults(defineProps<{ padded?: boolean }>(), { padded: true })
</script>

<template>
  <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
    <div v-if="$slots.header" class="border-b border-slate-200 px-5 py-4">
      <slot name="header" />
    </div>
    <div :class="padded ? 'p-5' : ''">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-slate-200 px-5 py-4">
      <slot name="footer" />
    </div>
  </div>
</template>
