<script setup lang="ts">
// Calcado de Components/StatCard.vue del legacy, con un cambio
// deliberado: el legacy le daba un color distinto (verde/azul/ambar/
// naranja/rojo) a cada tarjeta sin ningun criterio semantico - exactamente
// el patron que se decidio no repetir. Todas las NxStatCard usan el
// mismo acento (indigo, color de marca) porque ninguna de estas es un
// estado de exito/advertencia/error, son solo cifras informativas.
//
// clickable/active: opt-in, no cambia el comportamiento por defecto (sigue
// siendo una cifra de solo lectura en Dashboard/SuperAdmin/etc.) - solo el
// listado de Catalogo la usa ademas como filtro (ver CatalogView.vue,
// "Sin stock"/"Inventario bajo"/etc.).
withDefaults(defineProps<{ label: string; value: string; icon: string; clickable?: boolean; active?: boolean }>(), {
  clickable: false,
  active: false,
})

defineEmits<{ click: [] }>()
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="min-w-0 rounded-xl border p-4 text-left shadow-sm transition-colors"
    :class="[
      clickable ? 'cursor-pointer hover:border-indigo-300' : '',
      active ? 'border-indigo-400 bg-indigo-50/60 ring-1 ring-indigo-400' : 'border-slate-200 bg-white',
    ]"
    @click="clickable ? $emit('click') : undefined"
  >
    <div class="flex min-w-0 items-center gap-3">
      <div class="flex-shrink-0 rounded-lg bg-indigo-50 p-2">
        <i :class="icon" class="text-lg text-indigo-600" />
      </div>
      <div class="min-w-0">
        <p class="truncate text-xs font-medium text-slate-500">{{ label }}</p>
        <p class="truncate text-lg font-bold text-slate-900">{{ value }}</p>
      </div>
    </div>
  </component>
</template>
