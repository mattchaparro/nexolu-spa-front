import type { Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

export interface SalesTotals {
  services: number
  charged: number
  commission: number
  /** Lo que queda tras pagar comisiones. NO es utilidad: faltan gastos. */
  after_commission: number
  cash: number
  average_ticket: number
}

export interface SalesByPerson {
  resource_id: number | null
  name: string
  services: number
  charged: number
  commission: number
  /** Su porcentaje real del período, promediando servicios a tasas distintas. */
  effective_rate: number | null
}

export interface SalesByMethod {
  payment_method_id: number | null
  name: string
  counts_as_cash: boolean
  services: number
  charged: number
}

export interface SalesByService {
  service_id: number | null
  name: string
  services: number
  charged: number
}

export interface SalesByDay {
  date: string
  services: number
  charged: number
  commission: number
}

export interface SalesReport {
  from: string
  to: string
  totals: SalesTotals
  by_person: SalesByPerson[]
  by_payment_method: SalesByMethod[]
  by_service: SalesByService[]
  by_day: SalesByDay[]
  filters: {
    resources: Array<{ id: number; name: string }>
    payment_methods: Array<{ id: number; name: string }>
  }
}

export interface SalesFilters {
  from: string
  to: string
  resourceId: number | null
  paymentMethodId: number | null
}

export function useSalesReport(filters: Ref<SalesFilters>) {
  return useQuery({
    queryKey: ['reports', 'sales', filters],
    queryFn: async () =>
      (
        await httpClient.get<SalesReport>('/reports/sales', {
          params: {
            from: filters.value.from,
            to: filters.value.to,
            ...(filters.value.resourceId ? { resource_id: filters.value.resourceId } : {}),
            ...(filters.value.paymentMethodId
              ? { payment_method_id: filters.value.paymentMethodId }
              : {}),
          },
        })
      ).data,
  })
}
