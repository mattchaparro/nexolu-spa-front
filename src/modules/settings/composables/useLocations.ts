import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| Sedes
|------------------------------------------------------------------------------
| Clientes y catálogo son del NEGOCIO -- la misma persona con la misma tarjeta
| de sellos en los dos locales. La agenda y la gente son de la SEDE.
|
| El tope del plan viene contado del servidor, igual que el de personas: el
| front lo muestra, nunca lo calcula.
*/

export interface Location {
  id: number
  name: string
  slug: string
  address: string | null
  phone: string | null
  city: string | null
  maps_url: string | null
  is_primary: boolean
  is_active: boolean
  sort_order: number
  /** Cuánta gente atiende ahí hoy. Es lo que impide apagarla a la ligera. */
  active_resources_count: number | null
}

export interface LocationLimit {
  limit: number | null
  used: number
  remaining: number | null
}

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () =>
      (await httpClient.get<{ locations: Location[]; limit: LocationLimit | null }>('/locations'))
        .data,
  })
}

export function useSaveLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Partial<Location> & { name: string }) => {
      const { id, ...body } = payload
      return (await httpClient.post(id ? `/locations/${id}` : '/locations', body)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
      // Quien atiende y la rejilla se leen por sede: una sede nueva o
      // renombrada cambia lo que muestran los dos.
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      queryClient.invalidateQueries({ queryKey: ['agenda'] })
    },
  })
}

/**
 * Apagar, no borrar. Lo que se atendió ahí no puede desaparecer porque el
 * local haya cerrado.
 */
export function useDisableLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.delete(`/locations/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  })
}

export function useMakePrimaryLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.post(`/locations/${id}/primary`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  })
}
