<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { NxButton, NxInput, NxModal } from '@/ui'

import {
  useDisableLocation,
  useLocations,
  useMakePrimaryLocation,
  useSaveLocation,
  type Location,
} from '../composables/useLocations'

const { notify } = useSystemAlert()

const { data, isLoading } = useLocations()
const { mutateAsync: save, isPending } = useSaveLocation()
const { mutateAsync: disable } = useDisableLocation()
const { mutateAsync: makePrimary } = useMakePrimaryLocation()

const locations = computed(() => data.value?.locations ?? [])
const limit = computed(() => data.value?.limit ?? null)

/**
 * Cuántas sedes van de las que da el plan.
 *
 * El tope viene del servidor; el uso se lee de la lista que está en pantalla,
 * que es lo que la persona tiene delante. Contar activas acá y allá por
 * caminos distintos es como se llega a un cartel que dice 2 de 3 al lado de
 * tres tarjetas.
 */
const activas = computed(() => locations.value.filter((l) => l.is_active).length)

const cupo = computed(() => {
  if (!limit.value || limit.value.limit === null) return null

  return `${activas.value} de ${limit.value.limit} ${limit.value.limit === 1 ? 'sede' : 'sedes'} de tu plan`
})

const sinCupo = computed(
  () => limit.value?.limit !== null && activas.value >= (limit.value?.limit ?? 0),
)

const open = ref(false)
const editing = ref<Location | null>(null)
const error = ref<string | null>(null)

const name = ref('')
const address = ref('')
const phone = ref('')
const city = ref('')
const mapsUrl = ref('')

function abrir(location: Location | null): void {
  editing.value = location
  error.value = null

  name.value = location?.name ?? ''
  address.value = location?.address ?? ''
  phone.value = location?.phone ?? ''
  city.value = location?.city ?? ''
  mapsUrl.value = location?.maps_url ?? ''

  open.value = true
}

function mensaje(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    'No pudimos guardar la sede.'
  )
}

async function submit(): Promise<void> {
  error.value = null

  try {
    await save({
      id: editing.value?.id,
      name: name.value.trim(),
      address: address.value.trim() || null,
      phone: phone.value.trim() || null,
      city: city.value.trim() || null,
      maps_url: mapsUrl.value.trim() || null,
    })
    open.value = false
    notify('Sede guardada.', 'success')
  } catch (e) {
    error.value = mensaje(e)
  }
}

async function apagar(location: Location): Promise<void> {
  if (
    !window.confirm(
      `¿Apagar "${location.name}"? Deja de aparecer en la agenda, pero todo lo que se atendió ahí se conserva.`,
    )
  ) {
    return
  }

  try {
    await disable(location.id)
    notify('Sede apagada.', 'success')
  } catch (e) {
    notify(mensaje(e), 'error')
  }
}

async function hacerPrincipal(location: Location): Promise<void> {
  try {
    await makePrimary(location.id)
    notify(`"${location.name}" es ahora la sede principal.`, 'success')
  } catch (e) {
    notify(mensaje(e), 'error')
  }
}

const canSubmit = computed(() => name.value.trim().length > 1)
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Sedes</h1>
        <p class="mt-1 max-w-2xl text-sm text-slate-500">
          Tus locales. Los clientes y el catálogo son los mismos en todos — la misma persona
          conserva su tarjeta de sellos vaya donde vaya. Lo que cambia por sede es quién atiende y
          la agenda.
        </p>
        <p v-if="cupo" class="mt-2 text-xs font-medium text-slate-500">{{ cupo }}</p>
      </div>

      <NxButton :disabled="sinCupo" @click="abrir(null)">Nueva sede</NxButton>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <template v-else>
      <p v-if="sinCupo" class="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Ya usaste las sedes que da tu plan. Puedes apagar una que no uses para liberar el cupo, o
        escribirnos para ampliarlo.
      </p>

      <div class="grid gap-3 sm:grid-cols-2">
        <article
          v-for="l in locations"
          :key="l.id"
          class="rounded-lg border bg-white p-4"
          :class="l.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-medium text-slate-800">{{ l.name }}</p>
              <p v-if="l.city || l.address" class="mt-0.5 text-sm text-slate-600">
                {{ [l.address, l.city].filter(Boolean).join(' · ') }}
              </p>
            </div>

            <span
              v-if="l.is_primary"
              class="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-800"
            >
              Principal
            </span>
            <span
              v-else-if="!l.is_active"
              class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
            >
              Apagada
            </span>
          </div>

          <p v-if="l.phone" class="mt-1 text-sm text-slate-500">{{ l.phone }}</p>

          <p class="mt-2 text-xs text-slate-500">
            {{ l.active_resources_count ?? 0 }}
            {{ l.active_resources_count === 1 ? 'persona atiende' : 'personas atienden' }} aquí
          </p>

          <div class="mt-3 flex flex-wrap gap-2">
            <NxButton variant="outline" size="sm" @click="abrir(l)">Editar</NxButton>
            <NxButton
              v-if="!l.is_primary && l.is_active"
              variant="ghost"
              size="sm"
              @click="hacerPrincipal(l)"
            >
              Hacer principal
            </NxButton>
            <NxButton
              v-if="!l.is_primary && l.is_active"
              variant="ghost"
              size="sm"
              @click="apagar(l)"
            >
              Apagar
            </NxButton>
          </div>
        </article>
      </div>

      <!-- La principal no se puede apagar: es donde cae todo lo que no diga
           otra sede. Decirlo acá evita el 422 sorpresa. -->
      <p class="mt-4 text-xs text-slate-500">
        La sede principal no se apaga: es donde entra todo lo que no diga otra cosa. Si vas a
        cerrarla, marca otra como principal primero.
      </p>
    </template>

    <NxModal
      :model-value="open"
      :title="editing ? 'Editar sede' : 'Nueva sede'"
      @update:model-value="open = false"
    >
      <div class="flex flex-col gap-4">
        <NxInput v-model="name" label="Nombre" placeholder="Chapinero" :disabled="isPending" />

        <div class="grid gap-3 sm:grid-cols-2">
          <NxInput v-model="city" label="Ciudad" placeholder="Bogotá" :disabled="isPending" />
          <NxInput v-model="phone" label="Teléfono" :disabled="isPending" />
        </div>

        <NxInput v-model="address" label="Dirección" :disabled="isPending" />

        <label class="text-sm text-slate-700">
          Enlace de Google Maps (opcional)
          <input
            v-model="mapsUrl"
            type="url"
            placeholder="https://maps.app.goo.gl/…"
            class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            :disabled="isPending"
          />
          <span class="mt-1 block text-xs text-slate-500">
            Va en el mensaje de confirmación, para que nadie llegue al local equivocado.
          </span>
        </label>

        <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

        <div class="flex justify-end gap-2">
          <NxButton variant="secondary" :disabled="isPending" @click="open = false">
            Cancelar
          </NxButton>
          <NxButton :loading="isPending" :disabled="!canSubmit" @click="submit">Guardar</NxButton>
        </div>
      </div>
    </NxModal>
  </section>
</template>
