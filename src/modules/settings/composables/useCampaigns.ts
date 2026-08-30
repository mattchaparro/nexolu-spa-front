import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

export type CampaignType = 'percent' | 'amount'
export type CampaignScope = 'all' | 'services' | 'categories'

export interface Campaign {
  id: number
  name: string
  description: string | null
  discount_type: CampaignType
  discount_value: number
  applies_to: CampaignScope
  service_ids: number[]
  category_ids: number[]
  starts_on: string
  ends_on: string | null
  is_active: boolean
  /** Cómo se lee, ya armado por el servidor. */
  label: string
  /** Si corre HOY. Lo calcula el backend para que la pantalla no compare fechas. */
  running: boolean
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () =>
      (
        await httpClient.get<{
          campaigns: Campaign[]
          types: Array<{ value: CampaignType; label: string }>
          scopes: Array<{ value: CampaignScope; label: string }>
        }>('/campaigns')
      ).data,
  })
}

export function useSaveCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Campaign> & { id?: number }) =>
      (await httpClient.post(id ? `/campaigns/${id}` : '/campaigns', payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}

export function useDisableCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.delete(`/campaigns/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}

/**
 * Las categorías del catálogo, para el alcance por categoría.
 *
 * Vive acá y no en catalog porque el front todavía no las consumía en ningún
 * lado: la pantalla de servicios las edita por su cuenta.
 */
export function useServiceCategories() {
  return useQuery({
    queryKey: ['service-categories'],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await httpClient.get<Array<{ id: number; name: string }>>('/service-categories')).data,
  })
}
