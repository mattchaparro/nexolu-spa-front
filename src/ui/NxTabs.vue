<script setup lang="ts">
// Wrapper fino de Tabs de PrimeVue (API nueva: Tabs/TabList/Tab/TabPanels/
// TabPanel) - ninguna pantalla importa "primevue" directo, todo pasa por
// src/ui (ver README "Nexolu UI"). Compone junto a NxTabList/NxTab/
// NxTabPanels/NxTabPanel.
// Prop/evento se llaman "value"/"update:value" (no "modelValue"), igual que
// el Tabs nativo de PrimeVue y que NxTab.value - así "v-model:value" queda
// consistente con como se lee el value en cada NxTab.
import PrimeTabs from 'primevue/tabs'

const props = defineProps<{ value: string | number }>()

const emit = defineEmits<{ 'update:value': [value: string | number] }>()
</script>

<template>
  <PrimeTabs :value="props.value" @update:value="(v) => emit('update:value', v)">
    <slot />
  </PrimeTabs>
</template>
