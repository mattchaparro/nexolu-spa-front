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

/**
 * Cómo premia la tarjeta.
 *
 * - `card`: junta N visitas, se lleva el premio, y vuelve a empezar. Los
 *   sellos se gastan.
 * - `ladder`: a las 5 un premio, a las 10 otro, a las 15 otro. Los sellos no
 *   se gastan nunca.
 */
export type LoyaltyMode = 'card' | 'ladder'

/** Un escalón de la escalera. Vacío en modo `card`. */
export interface LoyaltyTier {
  stamps_required: number
  reward_type: RewardType
  reward_value: number | null
  reward_service_id: number | null
  reward_label: string
}

export interface LoyaltyProgram {
  id: number
  name: string
  mode: LoyaltyMode
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
  tiers: LoyaltyTier[]
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
    mode: LoyaltyMode
    terms: string | null
    stamps_required: number
    /** En la escalera, el premio del SIGUIENTE hito -- no el del programa. */
    reward_label: string
    min_ticket: number
  } | null
  stamps: number
  /**
   * En la escalera, el siguiente hito -- no un total fijo.
   *
   * El backend los devuelve en los dos modos a propósito, para que la línea
   * "7 de 10 sellos, le faltan 3" del cobro funcione igual sin ramificar acá.
   */
  required: number
  remaining: number
  complete: boolean
  /** La escalera completa, para pintarla. Vacío en modo `card`. */
  tiers?: Array<{
    stamps_required: number
    reward_label: string
    reached: boolean
    status: 'available' | 'used' | 'expired' | null
  }>
  next_tier?: {
    stamps_required: number
    reward_label: string
    stamps_away: number
  } | null
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
