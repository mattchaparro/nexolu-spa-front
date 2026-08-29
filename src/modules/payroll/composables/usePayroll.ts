import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

export interface PendingRow {
  resource_id: number
  name: string
  mode: string
  period_start: string
  period_end: string
  services_count: number
  commission_total: number
  base_total: number
  bonus_total: number
  deduction_total: number
  net_total: number
}

export interface PreviewItem {
  charged_at: string
  service_name: string
  client_name: string | null
  charged: number
  commission_rate: number | null
  commission_amount: number
}

export interface PreviewAdjustment {
  id: number
  date: string
  kind: 'deduction' | 'bonus'
  category: string
  amount: number
  description: string | null
  category_label: string
  outside_period: boolean
}

export interface PayrollPreview {
  resource: { id: number; name: string }
  mode: string
  base_amount: number
  base_period: string
  base_until: string | null
  period_start: string
  period_end: string
  days: number
  services_count: number
  charged_total: number
  commission_total: number
  base_total: number
  earned_total: number
  bonus_total: number
  deduction_total: number
  net_total: number
  topped_up: number
  items: PreviewItem[]
  adjustments: PreviewAdjustment[]
}

export interface AdjustmentCategory {
  name: string
  kind: 'deduction' | 'bonus'
  label: string
  help: string
}

export interface AdjustmentRow {
  id: number
  resource_id: number
  resource_name: string | null
  date: string
  kind: 'deduction' | 'bonus'
  category: string
  category_label: string
  amount: number
  description: string | null
  settled: boolean
}

export interface CompensationRow {
  id: number
  name: string
  is_active: boolean
  payroll_mode: string
  base_amount: number
  base_period: string
  base_until: string | null
  payroll_started_on: string | null
}

export interface CompensationPayload {
  resources: CompensationRow[]
  modes: Array<{ name: string; label: string; uses_base: boolean }>
  base_periods: Array<{ name: string; label: string; days: number }>
}

export function usePendingPayroll() {
  return useQuery({
    queryKey: ['payroll', 'pending'],
    queryFn: async () =>
      (await httpClient.get<{ until: string; resources: PendingRow[] }>('/payroll/pending')).data,
  })
}

/**
 * El detalle de una persona. Se desactiva cuando no hay ninguna elegida
 * para no disparar una petición a `/payroll/resources/null/preview`.
 */
export function usePayrollPreview(resourceId: Ref<number | null>) {
  return useQuery({
    queryKey: ['payroll', 'preview', resourceId],
    enabled: () => resourceId.value !== null,
    // Se reintenta una vez de más sin sentido: un 422 "ya se liquidó hasta"
    // es una respuesta legítima, no una falla de red.
    retry: false,
    queryFn: async () =>
      (await httpClient.get<PayrollPreview>(`/payroll/resources/${resourceId.value}/preview`)).data,
  })
}

export function useSettlePayroll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      resourceId: number
      payment_method_id?: number | null
      notes?: string | null
    }) =>
      (
        await httpClient.post(`/payroll/resources/${payload.resourceId}/settle`, {
          payment_method_id: payload.payment_method_id ?? null,
          notes: payload.notes ?? null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      // La liquidación deja un gasto: la caja del día cambia con ella.
      queryClient.invalidateQueries({ queryKey: ['cash'] })
    },
  })
}

export function useAdjustments(resourceId: Ref<number | null>) {
  return useQuery({
    queryKey: ['payroll', 'adjustments', resourceId],
    queryFn: async () =>
      (
        await httpClient.get<{ catalog: AdjustmentCategory[]; adjustments: AdjustmentRow[] }>(
          '/payroll/adjustments',
          { params: resourceId.value ? { resource_id: resourceId.value } : {} },
        )
      ).data,
  })
}

export function useStoreAdjustment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      resource_id: number
      date: string
      category: string
      amount: number
      description?: string | null
    }) => (await httpClient.post('/payroll/adjustments', payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll'] }),
  })
}

export function useDeleteAdjustment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.delete(`/payroll/adjustments/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll'] }),
  })
}

export function useSettlements() {
  return useQuery({
    queryKey: ['payroll', 'settlements'],
    queryFn: async () => (await httpClient.get('/payroll/settlements')).data,
  })
}

export function useCompensation() {
  return useQuery({
    queryKey: ['payroll', 'compensation'],
    queryFn: async () => (await httpClient.get<CompensationPayload>('/payroll/compensation')).data,
  })
}

export function useUpdateCompensation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { id: number } & Record<string, unknown>) => {
      const { id, ...body } = payload
      return (await httpClient.put(`/payroll/compensation/${id}`, body)).data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll'] }),
  })
}
