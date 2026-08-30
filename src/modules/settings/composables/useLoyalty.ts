import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| Tarjeta de sellos
|------------------------------------------------------------------------------
| El saldo NUNCA se guarda en el front ni se calcula acá: viene contado del
| servidor en cada consulta. Un contador que el cliente mantiene por su cuenta
| es la misma trampa que en el servidor -- se desincroniza de las visitas
| reales y nadie se entera hasta el mostrador.
*/

export type RewardType = 'discount_percent' | 'discount_amount' | 'free_service'

export interface LoyaltyProgram {
  id: number
  name: string
  terms: string | null
  stamps_required: number
  reward_type: RewardType
  reward_value: number | null
  reward_service_id: number | null
  /** Cómo se le explica el premio a quien lo va a recibir. */
  reward_label: string
  /** Visita mínima para ganar sello. 0 = toda visita cuenta. */
  min_ticket: number
  is_active: boolean
}

export function useLoyaltyProgram() {
  return useQuery({
    queryKey: ['loyalty', 'program'],
    queryFn: async () =>
      (
        await httpClient.get<{
          program: LoyaltyProgram | null
          reward_types: Array<{ value: RewardType; label: string }>
        }>('/loyalty/program')
      ).data,
  })
}

export function useSaveLoyaltyProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Partial<LoyaltyProgram>) =>
      (await httpClient.post<{ program: LoyaltyProgram }>('/loyalty/program', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty'] })
    },
  })
}

export function useDisableLoyaltyProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => (await httpClient.delete('/loyalty/program')).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty'] })
    },
  })
}

/*
|------------------------------------------------------------------------------
| La tarjeta de un cliente
|------------------------------------------------------------------------------
*/

export interface LoyaltyCard {
  program: {
    id: number
    name: string
    terms: string | null
    stamps_required: number
    reward_label: string
    min_ticket: number
  } | null
  stamps: number
  required: number
  remaining: number
  complete: boolean
  rewards: Array<{ id: number; label: string; unlocked_at: string | null }>
}

export function useClientLoyalty(clientId: Ref<number | null>, enabled: Ref<boolean>) {
  return useQuery({
    queryKey: ['loyalty', 'card', clientId],
    enabled: () => clientId.value !== null && enabled.value,
    queryFn: async () =>
      (await httpClient.get<LoyaltyCard>(`/clients/${clientId.value}/loyalty`)).data,
  })
}
