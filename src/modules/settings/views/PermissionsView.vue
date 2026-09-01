<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { useSystemAlert } from '@/composables/useSystemAlert'
import { httpClient } from '@/services/http/client'
import { extractErrorMessage } from '@/utils/extractErrorMessage'
import { useAuthStore } from '@/stores/auth.store'
import { NxButton } from '@/ui'

interface TeamMember {
  id: number
  name: string
  email: string
  is_active: boolean
  is_self: boolean
  is_admin: boolean
  /** El dueño del negocio: ve todas las sedes y eso no se puede restringir. */
  is_owner: boolean
  /**
   * Las sedes ASIGNADAS a mano, no las que termina viendo.
   *
   * Vacío no es "todas": es "la sede donde trabaja". La pantalla necesita la
   * diferencia para poder decirlo, en vez de mostrar una marca que nadie puso.
   */
  location_ids: number[]
  resource_name: string | null
  role: string | null
  permissions: string[]
}

interface CatalogPermission {
  name: string
  label: string
  description: string
  feature: string | null
  sensitive: boolean
}

interface CatalogGroup {
  key: string
  label: string
  icon: string
  permissions: CatalogPermission[]
}

interface RoleOption {
  name: string
  label: string
  defaults: string[]
}

interface PermissionsPayload {
  users: TeamMember[]
  catalog: CatalogGroup[]
  roles: RoleOption[]
  locations: Array<{ id: number; name: string }>
}

const auth = useAuthStore()
const { notify } = useSystemAlert()
const queryClient = useQueryClient()

const { data, isLoading } = useQuery({
  queryKey: ['permissions'],
  queryFn: async () => (await httpClient.get<PermissionsPayload>('/permissions')).data,
})

const selectedId = ref<number | null>(null)
const role = ref<string | null>(null)
const granted = ref<Set<string>>(new Set())
const error = ref<string | null>(null)

const team = computed(() => data.value?.users ?? [])
const selected = computed(() => team.value.find((u) => u.id === selectedId.value) ?? null)

// El administrador tiene todo por su rol: la pantalla lo dice en vez de
// mostrar veinte casillas marcadas que no se pueden tocar.
const editable = computed(
  () => selected.value !== null && !selected.value.is_admin && !selected.value.is_self,
)

/** Solo se ofrecen los permisos de funciones que el negocio tiene encendidas. */
const catalog = computed<CatalogGroup[]>(() =>
  (data.value?.catalog ?? [])
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter((p) => !p.feature || auth.hasFeature(p.feature)),
    }))
    .filter((group) => group.permissions.length > 0),
)

watch(
  team,
  (users) => {
    if (selectedId.value === null) {
      selectedId.value = users.find((u) => !u.is_admin)?.id ?? users[0]?.id ?? null
    }
  },
  { immediate: true },
)

watch(
  selected,
  (user) => {
    role.value = user?.role ?? null
    granted.value = new Set(user?.permissions ?? [])
    error.value = null
  },
  { immediate: true },
)

function toggle(name: string): void {
  const next = new Set(granted.value)
  if (next.has(name)) {
    next.delete(name)
  } else {
    next.add(name)
  }

  granted.value = next
}

/** Cambiar de rol re-carga las casillas con las de ese rol, sin guardar. */
function applyRoleDefaults(name: string): void {
  role.value = name
  granted.value = new Set(data.value?.roles.find((r) => r.name === name)?.defaults ?? [])
}

const changed = computed(() => {
  if (!selected.value) return false
  if (role.value !== selected.value.role) return true

  const original = new Set(selected.value.permissions)
  if (original.size !== granted.value.size) return true
  return [...granted.value].some((p) => !original.has(p))
})

const { mutateAsync: save, isPending } = useMutation({
  mutationFn: async () =>
    (
      await httpClient.put(`/permissions/${selectedId.value}`, {
        role: role.value,
        permissions: [...granted.value],
      })
    ).data,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['permissions'] })
  },
})

async function submit(): Promise<void> {
  error.value = null

  try {
    await save()
    notify(`Permisos de ${selected.value?.name} actualizados.`, 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar los permisos.')
  }
}

function roleLabel(name: string | null): string {
  return data.value?.roles.find((r) => r.name === name)?.label ?? '—'
}

/*
|------------------------------------------------------------------------------
| Sedes
|------------------------------------------------------------------------------
| Eje distinto de los permisos, y por eso se guarda aparte: QUÉ puede hacer y
| DÓNDE son dos preguntas. A un administrador no se le editan permisos -- los
| tiene todos por su rol -- pero sí se le acota el local, que es justo el caso
| que las sedes vienen a resolver.
*/
const sedes = computed(() => data.value?.locations ?? [])
const variasSedes = computed(() => sedes.value.length > 1)

const asignadas = ref<Set<number>>(new Set())

watch(
  selected,
  (user) => {
    asignadas.value = new Set(user?.location_ids ?? [])
  },
  { immediate: true },
)

/** Al dueño no se le restringe: un negocio sin quién vea sus dos locales no se administra. */
const editableSedes = computed(
  () => selected.value !== null && !selected.value.is_owner && !selected.value.is_self,
)

const sedesCambiadas = computed(() => {
  if (!selected.value) return false

  const original = new Set(selected.value.location_ids)
  if (original.size !== asignadas.value.size) return true

  return [...asignadas.value].some((id) => !original.has(id))
})

function toggleSede(id: number): void {
  const next = new Set(asignadas.value)

  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }

  asignadas.value = next
}

const { mutateAsync: saveSedes, isPending: savingSedes } = useMutation({
  mutationFn: async () =>
    (
      await httpClient.put(`/permissions/${selectedId.value}/locations`, {
        location_ids: [...asignadas.value],
      })
    ).data,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['permissions'] })
    // Lo que ve esta persona cambió: la agenda y la caja se leen por sede.
    queryClient.invalidateQueries({ queryKey: ['agenda'] })
    queryClient.invalidateQueries({ queryKey: ['cash'] })
  },
})

async function submitSedes(): Promise<void> {
  error.value = null

  try {
    await saveSedes()
    notify(`Sedes de ${selected.value?.name} actualizadas.`, 'success')
  } catch (e) {
    error.value = extractErrorMessage(e, 'No pudimos guardar las sedes.')
  }
}
</script>

<template>
  <section class="p-6 md:p-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-slate-800">Permisos del equipo</h1>
      <p class="mt-1 max-w-2xl text-sm text-slate-500">
        Lo que ves marcado es exactamente lo que esa persona puede hacer. Presta atención a los
        permisos de clientes: tu base con teléfonos es tuya, y quien la ve puede llevársela.
      </p>
    </header>

    <p v-if="isLoading" class="text-sm text-slate-500">Cargando…</p>

    <div v-else class="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <!-- El equipo -->
      <aside
        class="divide-y divide-slate-100 self-start rounded-lg border border-slate-200 bg-white"
      >
        <button
          v-for="member in team"
          :key="member.id"
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
          :class="member.id === selectedId ? 'bg-slate-50' : ''"
          @click="selectedId = member.id"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-slate-800">{{ member.name }}</span>
            <span class="block truncate text-xs text-slate-500">
              {{ member.resource_name ?? member.email }}
            </span>
          </span>
          <span
            class="shrink-0 rounded px-2 py-0.5 text-xs"
            :class="
              member.is_admin ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
            "
          >
            {{ roleLabel(member.role) }}
          </span>
        </button>
      </aside>

      <!-- La persona -->
      <div v-if="selected" class="min-w-0">
        <div
          v-if="selected.is_self"
          class="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Estos son tus propios permisos. Nadie puede editarse a sí mismo: es lo que evita quedarse
          fuera de tu propio negocio por un clic.
        </div>

        <div
          v-else-if="selected.is_admin"
          class="mb-4 rounded-md bg-indigo-50 px-4 py-3 text-sm text-indigo-900"
        >
          {{ selected.name }} es administradora y tiene todos los permisos por su rol, incluidos los
          que se agreguen más adelante. Para limitarla, cámbiale primero el rol.
        </div>

        <!-- Sedes. Eje aparte de los permisos y se guarda aparte: a una
             administradora no se le editan permisos, pero sí el local. -->
        <div v-if="variasSedes" class="mb-5 rounded-lg border border-slate-200 bg-white p-4">
          <p class="mb-2 text-sm font-medium text-slate-800">Sedes que ve</p>

          <p v-if="selected.is_owner" class="text-sm text-slate-600">
            {{ selected.name }} es la dueña del negocio: ve todas las sedes, siempre. Eso no se
            puede restringir — si nadie pudiera ver los dos locales, el negocio no podría
            administrarse.
          </p>

          <template v-else>
            <p class="mb-3 text-xs text-slate-500">
              La agenda, la caja y los reportes se filtran por esto. Si no marcas ninguna, ve la
              sede donde trabaja.
            </p>

            <div class="flex flex-wrap gap-2">
              <button
                v-for="sede in sedes"
                :key="sede.id"
                type="button"
                class="rounded-full border px-3 py-1 text-sm transition"
                :class="
                  asignadas.has(sede.id)
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-400'
                "
                :disabled="!editableSedes || savingSedes"
                @click="toggleSede(sede.id)"
              >
                {{ sede.name }}
              </button>
            </div>

            <p v-if="!asignadas.size" class="mt-2 text-xs text-slate-500">
              Sin marcar: verá sólo la sede donde atiende.
            </p>

            <div v-if="sedesCambiadas" class="mt-3">
              <NxButton size="sm" :loading="savingSedes" @click="submitSedes">
                Guardar sedes
              </NxButton>
            </div>
          </template>
        </div>

        <!-- Rol -->
        <div class="mb-5 rounded-lg border border-slate-200 bg-white p-4">
          <p class="mb-2 text-sm font-medium text-slate-800">Rol</p>
          <p class="mb-3 text-xs text-slate-500">
            El rol solo define con qué permisos arranca. A partir de ahí ajustas uno por uno.
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="option in (data?.roles ?? []).filter((r) => r.name !== 'admin')"
              :key="option.name"
              type="button"
              class="rounded-full border px-3 py-1 text-sm transition"
              :class="
                role === option.name
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-200 text-slate-700 hover:border-slate-400'
              "
              :disabled="!editable || isPending"
              @click="applyRoleDefaults(option.name)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <!-- Permisos -->
        <div class="space-y-4">
          <div
            v-for="group in catalog"
            :key="group.key"
            class="rounded-lg border border-slate-200 bg-white"
          >
            <p class="border-b border-slate-100 px-4 py-2.5 text-sm font-medium text-slate-800">
              {{ group.label }}
            </p>

            <label
              v-for="permission in group.permissions"
              :key="permission.name"
              class="flex cursor-pointer items-start gap-3 border-b border-slate-50 px-4 py-3 last:border-b-0"
              :class="permission.sensitive ? 'bg-amber-50/50' : ''"
            >
              <input
                type="checkbox"
                class="mt-0.5"
                :checked="selected.is_admin || granted.has(permission.name)"
                :disabled="!editable || isPending"
                @change="toggle(permission.name)"
              />
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="text-sm text-slate-800">{{ permission.label }}</span>
                  <span
                    v-if="permission.sensitive"
                    class="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900"
                  >
                    dato sensible
                  </span>
                </span>
                <span class="mt-0.5 block text-xs text-slate-500">{{
                  permission.description
                }}</span>
              </span>
            </label>
          </div>
        </div>

        <p v-if="error" class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error }}
        </p>

        <NxButton
          v-if="editable"
          class="mt-5"
          :loading="isPending"
          :disabled="!changed"
          @click="submit"
        >
          Guardar permisos de {{ selected.name }}
        </NxButton>
      </div>
    </div>
  </section>
</template>
