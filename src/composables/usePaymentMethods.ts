import { useQuery } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

export interface PaymentMethodOption {
  id: number
  name: string
  counts_as_cash: boolean
}

/**
 * Los medios de pago que este negocio acepta.
 *
 * Uno solo para toda la app: estaba copiado en el checkout, en el servicio sin
 * cita, en gastos y en nómina, y cuatro copias de la misma query es como una
 * pantalla termina ofreciendo un medio que el negocio ya deshabilitó.
 */
export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    // Cambian cuando el dueño toca la configuración, no durante la jornada.
    staleTime: 10 * 60_000,
    queryFn: async () =>
      (await httpClient.get<PaymentMethodOption[]>('/payment-methods')).data,
  })
}
