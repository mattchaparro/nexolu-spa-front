import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| La lista de espera, vista desde el mostrador
|------------------------------------------------------------------------------
| Pantalla de LECTURA con un solo verbo: cerrar una espera. Tomar un cupo a
| nombre de alguien no existe aquí a propósito — eso es agendar la cita normal,
| que ya cierra la espera sola.
*/

export interface WaitlistAdminEntry {
  id: number
  status: string
  status_label: string
  client_name: string | null
  phone: string
  service: string | null
  preferred_resource: string | null
  location: string | null
  date_from: string | null
  date_to: string | null
  time_from: string | null
  time_to: string | null
  last_notified_at: string | null
  created_at: string
}

export interface WaitlistAdminPayload {
  data: WaitlistAdminEntry[]
  /** Cuántas personas siguen esperando. */
  open: number
}

export function useWaitlistAdmin(status: Ref<string | null>, locationId?: Ref<number | null>) {
  return useQuery({
    queryKey: ['waitlist-admin', status, locationId ?? null],
    queryFn: async () =>
      (
        await httpClient.get<WaitlistAdminPayload>('/waitlist', {
          params: {
            ...(status.value ? { status: status.value } : {}),
            ...(locationId?.value ? { location_id: locationId.value } : {}),
          },
        })
      ).data,
  })
}

export function useStopWaitlistEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.post(`/waitlist/${id}/stop`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['waitlist-admin'] }),
  })
}
