<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useAuthStore } from '@/stores/auth.store'
import { NxButton } from '@/ui'

import ServiceFormModal from '../components/ServiceFormModal.vue'
import {
  useAdminServices,
  useBulkServiceVisibility,
  useDeactivateService,
  type AdminService,
} from '../composables/useCatalog'

const auth = useAuthStore()
const { notify } = useSystemAlert()

const { data: services, isLoading } = useAdminServices()
const { mutateAsync: deactivate } = useDeactivateService()
const { mutateAsync: cambiarVisibilidad, isPending: cambiando } = useBulkServiceVisibility()

/*
|------------------------------------------------------------------------------
| Agrupado por familia, y con una acción para toda la familia
|------------------------------------------------------------------------------
| El caso que lo pidió: renunció la lashista. Con cuarenta y un servicios en
| una parrilla plana, sacar las nueve de pestañas de internet era abrir una por
| una y apagar el mismo interruptor nueve veces -- y otras nueve para volver a
| ponerlas cuando entre la que sigue.
|
| Lo que pasa de verdad con nueve pasos es que nadie los da, y la página sigue
| vendiendo algo que el local ya no presta.
*/
const grupos = computed(() => {
  const porCategoria = new Map<number | null, { nombre: string; items: AdminService[] }>()

  for (const s of services.value ?? []) {
    const id = s.category?.id ?? null
    // "Sin categoría" y no esconderlos: un servicio recién creado nace sin
    // familia, y no verlo en su propia pantalla sería peor.
    const nombre = s.category?.name ?? 'Sin categoría'

    if (!porCategoria.has(id)) porCategoria.set(id, { nombre, items: [] })

    porCategoria.get(id)!.items.push(s)
  }

  return [...porCategoria].map(([id, g]) => ({
    id,
    nombre: g.nombre,
    items: g.items,
    // Cuántos de la familia se ofrecen hoy por internet: es lo que decide si
    // el botón dice "esconder" o "mostrar", y lo que se le muestra al lado.
    enLinea: g.items.filter((s) => s.is_bookable_online && s.is_active).length,
    activos: g.items.filter((s) => s.is_active).length,
  }))
})

async function cambiarFamilia(grupo: { nombre: string; items: AdminService[]; enLinea: number }) {
  const esconder = grupo.enLinea > 0
  const afectados = grupo.items.filter((s) => s.is_active)

  const pregunta = esconder
    ? `¿Esconder los ${afectados.length} servicios de "${grupo.nombre}" de la página pública? Se siguen pudiendo cobrar en el local.`
    : `¿Volver a mostrar los ${afectados.length} servicios de "${grupo.nombre}" en la página pública?`

  if (!window.confirm(pregunta)) return

  const { message } = await cambiarVisibilidad({
    service_ids: afectados.map((s) => s.id),
    is_bookable_online: !esconder,
  })

  notify(message, 'success')
}

/** Un solo servicio, sin abrir el formulario. */
async function cambiarUno(service: AdminService): Promise<void> {
  const { message } = await cambiarVisibilidad({
    service_ids: [service.id],
    is_bookable_online: !service.is_bookable_online,
  })

  notify(message, 'success')
}

const editing = ref<AdminService | null>(null)
const open = ref(false)

function create(): void {
  editing.value = null
  open.value = true
}

function edit(service: AdminService): void {
  editing.value = service
  open.value = true
}

function onSaved(): void {
  open.value = false
  notify('Servicio guardado.', 'success')
}

async function remove(service: AdminService): Promise<void> {
  if (
    !window.confirm(
      `¿Desactivar "${service.name}"? Dejará de ofrecerse, pero se conserva su historial.`,
    )
  ) {
    return
  }

  await deactivate(service.id)
  notify('Servicio desactivado.', 'success')
}

function money(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: auth.business?.currency ?? 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Servicios</h1>
        <p class="mt-1 text-sm text-slate-500">Lo que ofrece {{ auth.business?.name }}.</p>
      </div>
      <NxButton v-if="auth.can('servicios.gestionar')" @click="create">Nuevo servicio</NxButton>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <p
      v-else-if="!services?.length"
      class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600"
    >
      Todavía no hay servicios. Crea el primero para poder agendar.
    </p>

    <!-- Agrupado por familia. Con cuarenta y un servicios, una parrilla
         plana obliga a buscar con los ojos; con el encabezado, "las de
         pestañas" son un bloque que se ve entero. -->
    <div v-else class="flex flex-col gap-8">
      <section v-for="grupo in grupos" :key="grupo.id ?? 'sin'">
        <header class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {{ grupo.nombre }}
            </h2>
            <p class="text-xs text-slate-400">
              {{ grupo.activos }} {{ grupo.activos === 1 ? 'servicio' : 'servicios' }} ·
              <span v-if="grupo.enLinea === 0" class="text-amber-700">
                ninguno se ofrece por internet
              </span>
              <span v-else-if="grupo.enLinea === grupo.activos">todos en la página</span>
              <span v-else class="text-amber-700">{{ grupo.enLinea }} en la página</span>
            </p>
          </div>

          <!-- La acción para TODA la familia. Es el caso real: se fue quien
               hacía pestañas, y hay que sacar las nueve de una. -->
          <NxButton
            v-if="auth.can('servicios.gestionar') && grupo.activos"
            variant="outline"
            size="sm"
            :loading="cambiando"
            @click="cambiarFamilia(grupo)"
          >
            {{ grupo.enLinea > 0 ? 'Esconder de la página' : 'Mostrar en la página' }}
          </NxButton>
        </header>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="service in grupo.items"
            :key="service.id"
            class="overflow-hidden rounded-lg border border-slate-200 bg-white"
            :class="{ 'opacity-60': !service.is_active }"
          >
            <div class="flex h-32 items-center justify-center bg-slate-100">
              <img
                v-if="service.image_url"
                :src="service.image_url"
                :alt="service.name"
                class="h-full w-full object-cover"
              />
              <span v-else class="text-sm text-slate-400">Sin imagen</span>
            </div>

            <div class="p-4">
              <div class="flex items-start justify-between gap-2">
                <h2 class="font-medium text-slate-800">{{ service.name }}</h2>
                <span class="shrink-0 font-medium tabular-nums text-slate-700">
                  {{ money(service.price) }}
                </span>
              </div>

              <p class="mt-1 text-sm text-slate-500">
                {{ service.duration_min }} min
                <span v-if="service.occupied_min !== service.duration_min" class="text-slate-400">
                  · ocupa {{ service.occupied_min }}
                </span>
              </p>

              <p class="mt-1 text-xs text-slate-500">
                {{ service.resource_ids?.length ?? 0 }} del equipo
                <span v-if="!service.is_bookable_online" class="ml-1 text-amber-700"
                  >· solo en el local</span
                >
                <span v-if="!service.is_active" class="ml-1 text-slate-500">· inactivo</span>
              </p>

              <div v-if="auth.can('servicios.gestionar')" class="mt-3 flex flex-wrap gap-2">
                <NxButton variant="outline" size="sm" @click="edit(service)">Editar</NxButton>
                <!-- Uno solo, sin abrir el formulario: es el otro caso que pidió
                 el dueño -- esconder un servicio puntual, no toda la familia. -->
                <NxButton
                  v-if="service.is_active"
                  variant="ghost"
                  size="sm"
                  :loading="cambiando"
                  @click="cambiarUno(service)"
                >
                  {{ service.is_bookable_online ? 'Esconder' : 'Mostrar' }}
                </NxButton>
                <NxButton
                  v-if="service.is_active"
                  variant="ghost"
                  size="sm"
                  @click="remove(service)"
                >
                  Desactivar
                </NxButton>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>

    <ServiceFormModal :service="editing" :open="open" @close="open = false" @saved="onSaved" />
  </section>
</template>
