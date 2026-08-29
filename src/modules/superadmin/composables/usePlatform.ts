import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

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
  scheduling_settings: Record<string, number>
  owners: Array<{ id: number; name: string; email: string; is_active: boolean }>
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
          plans: Record<string, Record<string, boolean>>
          verticals: string[]
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
