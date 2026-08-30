<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { useAuthStore } from '@/stores/auth.store'
import { NxButton } from '@/ui'

import ResourceFormModal from '../components/ResourceFormModal.vue'
import ScheduleEditor from '../components/ScheduleEditor.vue'
import { useSaveResource, useTeam, type TeamResource } from '../composables/useCatalog'

const auth = useAuthStore()
const { notify } = useSystemAlert()

const { data: team, isLoading } = useTeam()
const { mutateAsync: save } = useSaveResource()

const editing = ref<TeamResource | null>(null)
const formOpen = ref(false)
const schedulingFor = ref<TeamResource | null>(null)

const staff = computed(() => team.value?.filter((r) => r.type === 'staff') ?? [])
const spaces = computed(() => team.value?.filter((r) => r.type !== 'staff') ?? [])

/*
|------------------------------------------------------------------------------
| Cupo del plan
|------------------------------------------------------------------------------
| El TOPE viene del plan y casi nunca cambia; el USO cambia cada vez que se
| agrega o se desactiva a alguien. Por eso el tope se lee de la sesión y el uso
| se cuenta de la lista que ya está en pantalla, en vez de confiar en el número
| que vino con el login: un contador cacheado que se desincroniza de la
| realidad es exactamente el bug que el sistema viejo terminó parcheando con un
| comando de reparación.
*/

const limiteEquipo = computed<number | null>(
  () => auth.business?.plan_usage?.max_resources?.limit ?? null,
)

/** Sólo cuenta la gente ACTIVA: desactivar a alguien libera el cupo. */
const equipoActivo = computed(() => staff.value.filter((r) => r.is_active).length)

const cupoLleno = computed(
  () => limiteEquipo.value !== null && equipoActivo.value >= limiteEquipo.value,
)

const TYPE_LABELS: Record<string, string> = {
  staff: 'Persona del equipo',
  station: 'Puesto',
  room: 'Cabina',
  equipment: 'Equipo',
}

function create(): void {
  editing.value = null
  formOpen.value = true
}

function edit(resource: TeamResource): void {
  editing.value = resource
  formOpen.value = true
}

async function toggleActive(resource: TeamResource): Promise<void> {
  const activating = !resource.is_active

  if (
    !activating &&
    !window.confirm(`¿Desactivar a ${resource.name}? Dejará de aparecer en la agenda y no podrá entrar.`)
  ) {
    return
  }

  await save({ id: resource.id, payload: { is_active: activating } })
  notify(activating ? 'Reactivado.' : 'Desactivado.', 'success')
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-800">Equipo</h1>
        <p class="mt-1 text-sm text-slate-500">
          Quién atiende y qué espacios se ocupan en {{ auth.business?.name }}.
        </p>
        <!-- Sólo si hay tope. Con plan sin límite, un "3 de ∞" es ruido. -->
        <p v-if="limiteEquipo !== null" class="mt-1 text-sm">
          <span :class="cupoLleno ? 'font-medium text-amber-700' : 'text-slate-500'">
            {{ equipoActivo }} de {{ limiteEquipo }} personas de tu plan
          </span>
          <span v-if="cupoLleno" class="text-slate-500">
            · desactiva a alguien para liberar un cupo
          </span>
        </p>
      </div>
      <!-- No se deshabilita aunque el cupo esté lleno: una cabina o una silla
           no gastan cupo de plan, y bloquear el botón entero impediría
           agregarlas. El tope se aplica sobre el TIPO, dentro del formulario. -->
      <NxButton v-if="auth.can('recursos.gestionar')" @click="create">Agregar</NxButton>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <template v-else>
      <p v-if="!team?.length" class="rounded-md bg-slate-100 px-4 py-6 text-sm text-slate-600">
        Todavía no hay nadie. Agrega a la primera persona para poder agendar.
      </p>

      <div v-if="staff.length" class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="person in staff"
          :key="person.id"
          class="rounded-lg border border-slate-200 bg-white p-4"
          :class="{ 'opacity-60': !person.is_active }"
          :style="person.color ? { borderLeft: `3px solid ${person.color}` } : undefined"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="person.photo_url"
              :src="person.photo_url"
              :alt="person.name"
              class="h-12 w-12 rounded-full object-cover"
            />
            <div
              v-else
              class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"
            >
              {{ person.name.charAt(0) }}
            </div>

            <div>
              <p class="font-medium text-slate-800">{{ person.name }}</p>
              <p class="text-xs text-slate-500">
                {{ person.user_id ? 'Con acceso al sistema' : 'Sin cuenta' }}
                <span v-if="!person.is_active"> · fuera de la agenda</span>
              </p>
            </div>
          </div>

          <div v-if="auth.can('recursos.gestionar')" class="mt-3 flex flex-wrap gap-2">
            <NxButton variant="outline" size="sm" @click="edit(person)">Editar</NxButton>
            <NxButton variant="outline" size="sm" @click="schedulingFor = person">Horario</NxButton>
            <NxButton variant="ghost" size="sm" @click="toggleActive(person)">
              {{ person.is_active ? 'Desactivar' : 'Reactivar' }}
            </NxButton>
          </div>
        </article>
      </div>

      <!-- Los espacios van aparte: se ocupan igual que una persona, pero no
           son una agenda que alguien mire ni tienen cuenta. -->
      <template v-if="spaces.length">
        <h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">Espacios y equipos</h2>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="space in spaces"
            :key="space.id"
            class="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            :class="{ 'opacity-60': !space.is_active }"
          >
            <div>
              <p class="text-sm font-medium text-slate-800">{{ space.name }}</p>
              <p class="text-xs text-slate-500">{{ TYPE_LABELS[space.type] }}</p>
            </div>
            <NxButton
              v-if="auth.can('recursos.gestionar')"
              variant="ghost"
              size="sm"
              @click="schedulingFor = space"
            >
              Horario
            </NxButton>
          </article>
        </div>
      </template>
    </template>

    <ResourceFormModal
      :resource="editing"
      :open="formOpen"
      :cupo-lleno="cupoLleno"
      :limite-equipo="limiteEquipo"
      @close="formOpen = false"
      @saved="formOpen = false; notify('Guardado.', 'success')"
    />

    <ScheduleEditor
      :resource="schedulingFor"
      @close="schedulingFor = null"
      @saved="schedulingFor = null; notify('Horario actualizado.', 'success')"
    />
  </section>
</template>
