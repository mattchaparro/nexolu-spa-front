import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'
import type { AuthResponse } from '@/types/auth'

export interface BusinessCounts {
  users: number
  resources: number
  services: number
  appointments_30d: number
}

export interface PlatformBusiness {
  id: number
  name: string
  slug: string
  vertical: string
  timezone: string
  currency: string
  subscription_plan: string | null
  is_active: boolean
  created_at: string | null
  counts: BusinessCounts
}

export interface BusinessDetail extends PlatformBusiness {
  phone: string | null
  email: string | null
  country_code: string
  feature_flags: Record<string, boolean>
  resolved_features: Record<string, boolean>
  /** Excepciones concedidas a ESTE negocio. Vacío = manda el plan. */
  plan_limits: Record<string, number | null>
  /** El tope que rige hoy: preset del plan + excepciones. */
  resolved_limits: Record<string, number | null>
  /** Cuánto lleva usado contra cada tope. */
  plan_usage: Record<string, { limit: number | null; used: number; remaining: number | null }>
  scheduling_settings: Record<string, number>
  users: Array<{
    id: number
    name: string
    email: string
    is_active: boolean
    is_admin: boolean
    role: string | null
    resource_name: string | null
  }>
}

export interface PlatformDashboard {
  businesses: {
    total: number
    active: number
    by_vertical: Record<string, number>
    by_plan: Record<string, number>
  }
  users: number
  appointments: { last_30d: number; upcoming: number }
  idle: Array<{ id: number; name: string }>
}

export const VERTICAL_LABELS: Record<string, string> = {
  spa_unas: 'Spa de uñas',
  barberia: 'Barbería',
  estetica: 'Estética',
}

export const PLAN_LABELS: Record<string, string> = {
  basico: 'Básico',
  pro: 'Pro',
  full: 'Full',
}

export function usePlatformDashboard() {
  return useQuery({
    queryKey: ['platform', 'dashboard'],
    queryFn: async () => (await httpClient.get<PlatformDashboard>('/superadmin/dashboard')).data,
  })
}

export function usePlatformBusinesses(term: Ref<string>) {
  return useQuery({
    queryKey: ['platform', 'businesses', term],
    queryFn: async () =>
      (await httpClient.get<PlatformBusiness[]>('/superadmin/businesses', { params: { q: term.value } }))
        .data,
  })
}

export function usePlatformBusiness(id: Ref<number | null>) {
  return useQuery({
    queryKey: ['platform', 'business', id],
    enabled: () => id.value !== null,
    queryFn: async () =>
      (await httpClient.get<BusinessDetail>(`/superadmin/businesses/${id.value}`)).data,
  })
}

export function useFeatureCatalog() {
  return useQuery({
    queryKey: ['platform', 'feature-catalog'],
    // El catalogo cambia con un deploy, no en caliente.
    staleTime: 60 * 60_000,
    queryFn: async () =>
      (
        await httpClient.get<{
          flags: string[]
          /** El mismo catálogo, con nombre y grupo para mostrar en pantalla. */
          catalog: Array<{ key: string; label: string; group: string; help: string }>
          groups: string[]
          plans: Record<string, Record<string, boolean>>
          verticals: string[]
          /** Topes disponibles, con su etiqueta y unidad. */
          limits: Array<{ key: string; label: string; help: string; unit: string }>
          plan_limits: Record<string, Record<string, number | null>>
        }>('/superadmin/feature-catalog')
      ).data,
  })
}

function invalidatePlatform(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: ['platform'] })
}

export function useCreateBusiness() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      (await httpClient.post<BusinessDetail>('/superadmin/businesses', payload)).data,
    onSuccess: () => invalidatePlatform(queryClient),
  })
}

export function useUpdateBusiness() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Record<string, unknown>) =>
      (await httpClient.patch<BusinessDetail>(`/superadmin/businesses/${id}`, payload)).data,
    onSuccess: () => invalidatePlatform(queryClient),
  })
}

export function useToggleBusiness() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) =>
      (await httpClient.patch<BusinessDetail>(`/superadmin/businesses/${id}/toggle`)).data,
    onSuccess: () => invalidatePlatform(queryClient),
  })
}

/*
|------------------------------------------------------------------------------
| Flujos de etapas
|------------------------------------------------------------------------------
| El catálogo lo mantiene la plataforma y cada negocio elige uno. Cada etapa
| apunta a un estado núcleo del que dependen la agenda, la caja y la nómina.
*/

export interface StageAction {
  type: string
  config: Record<string, unknown>
}

export interface WorkflowStage {
  id: number
  key: string
  label: string
  color: string
  sort_order: number
  maps_to_status: string
  status_label: string
  is_initial: boolean
  actions: StageAction[]
}

export interface Workflow {
  id: number
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  businesses_count: number
  stages: WorkflowStage[]
}

export interface ActionMeta {
  type: string
  label: string
  help: string
  critical: boolean
  feature: string | null
  config: string[]
}

export interface WorkflowCatalog {
  workflows: Workflow[]
  statuses: Array<{ value: string; label: string; terminal: boolean }>
  actions: ActionMeta[]
  placeholders: string[]
}

export function useWorkflows() {
  return useQuery({
    queryKey: ['sa', 'workflows'],
    queryFn: async () =>
      (await httpClient.get<WorkflowCatalog>('/superadmin/workflows')).data,
  })
}

export function useSaveWorkflowStages() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, stages }: { id: number; stages: Array<Partial<WorkflowStage>> }) =>
      (await httpClient.put<Workflow>(`/superadmin/workflows/${id}/stages`, { stages })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sa', 'workflows'] }),
  })
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { name: string; description?: string | null }) =>
      (await httpClient.post<Workflow>('/superadmin/workflows', payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sa', 'workflows'] }),
  })
}

/**
 * "Entrar como" un usuario de un negocio.
 *
 * Devuelve un token nuevo a nombre de esa persona; el store lo adopta y guarda
 * el de plataforma aparte. No hay endpoint para volver: salir es cerrar la
 * sesión prestada.
 */
export function useImpersonate() {
  return useMutation({
    mutationFn: async (userId: number) =>
      (await httpClient.post<AuthResponse>(`/superadmin/impersonate/${userId}`)).data,
  })
}
