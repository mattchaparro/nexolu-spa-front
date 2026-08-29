import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

export interface PaymentBreakdownRow {
  id: number | null
  label: string
  counts_as_cash: boolean
  total: number
}

export interface CashTotals {
  total_charged: number
  total_cash: number
  total_other_methods: number
  total_expenses: number
  /** Todo lo que salió del cajón: gastos del día MÁS nómina y arriendo pagados en efectivo. */
  cash_out: number
  total_commissions: number
  opening_cash: number
  expected_cash: number
  appointments: number
  payment_breakdown: PaymentBreakdownRow[]
}

export interface Shift {
  id: number
  user: string | null
  opened_at: string
  closed_at: string | null
  opening_cash: number
  counted_cash: number | null
  expected_cash: number | null
  difference: number | null
  total_charged: number | null
  payment_breakdown: PaymentBreakdownRow[] | null
  is_open: boolean
}

export interface ClosingPreview extends CashTotals {
  date: string
  already_closed: boolean
  pending_dates: string[]
}

export interface Closing {
  id: number
  date: string
  total_charged: number
  total_cash: number
  total_expenses: number
  total_commissions: number
  expected_cash: number
  actual_cash: number
  difference: number
  closed_by: string | null
  note: string | null
}

export interface DailySummary {
  date: string
  totals: CashTotals
  appointments: {
    total: number
    completed: number
    cancelled: number
    no_show: number
    pending_checkout: number
  }
  by_resource: Array<{ name: string; appointments: number; charged: number; commission: number }>
}

export interface ExpenseRow {
  id: number
  date: string
  description: string
  value: number
  scope: string
  type: string | null
  expense_type_id: number | null
  payment_method: string | null
  payment_method_id: number | null
  receipt_url: string | null
}

function invalidateCash(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: ['cash'] })
  queryClient.invalidateQueries({ queryKey: ['daily-summary'] })
}

export function useShift() {
  return useQuery({
    queryKey: ['cash', 'shift'],
    queryFn: async () =>
      (await httpClient.get<{ shift: Shift | null; totals?: CashTotals }>('/cash/shift')).data,
    // El turno cambia con cada cobro: mantenerlo fresco importa mas que
    // ahorrarse la peticion.
    staleTime: 10_000,
  })
}

export function useOpenShift() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { opening_cash: number; note?: string }) =>
      (await httpClient.post<Shift>('/cash/shift/open', payload)).data,
    onSuccess: () => invalidateCash(queryClient),
  })
}

export function useCloseShift() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { counted_cash: number; note?: string }) =>
      (await httpClient.post<Shift>('/cash/shift/close', payload)).data,
    onSuccess: () => invalidateCash(queryClient),
  })
}

export function useClosingPreview(date: Ref<string>) {
  return useQuery({
    queryKey: ['cash', 'closing-preview', date],
    queryFn: async () =>
      (await httpClient.get<ClosingPreview>('/cash/closing/preview', { params: { date: date.value } }))
        .data,
  })
}

export function useClosings() {
  return useQuery({
    queryKey: ['cash', 'closings'],
    queryFn: async () => (await httpClient.get<Closing[]>('/cash/closings')).data,
  })
}

export function useCloseDay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { date: string; actual_cash: number; note?: string }) =>
      (await httpClient.post<Closing>('/cash/closing', payload)).data,
    onSuccess: () => invalidateCash(queryClient),
  })
}

export function useUndoClosing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.delete(`/cash/closings/${id}`)).data,
    onSuccess: () => invalidateCash(queryClient),
  })
}

export function useDailySummary(date: Ref<string>) {
  return useQuery({
    queryKey: ['daily-summary', date],
    queryFn: async () =>
      (await httpClient.get<DailySummary>('/daily-summary', { params: { date: date.value } })).data,
  })
}

export function useExpenses(from: Ref<string>, to: Ref<string>) {
  return useQuery({
    queryKey: ['expenses', from, to],
    queryFn: async () =>
      (
        await httpClient.get<{
          data: ExpenseRow[]
          totals: { operacional: number; administrativo: number; total: number }
        }>('/expenses', { params: { from: from.value, to: to.value } })
      ).data,
  })
}

export function useExpenseTypes() {
  return useQuery({
    queryKey: ['expenses', 'types'],
    staleTime: 10 * 60_000,
    queryFn: async () =>
      (await httpClient.get<Array<{ id: number; name: string }>>('/expenses/types')).data,
  })
}

export function useSaveExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
      receipt,
    }: {
      id?: number
      payload: Record<string, unknown>
      receipt?: File | null
    }) => {
      const form = new FormData()

      for (const [key, value] of Object.entries(payload)) {
        if (value === null || value === undefined || value === '') continue
        form.append(key, String(value))
      }

      if (receipt) form.append('receipt', receipt)

      return (await httpClient.post(id ? `/expenses/${id}` : '/expenses', form)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      // Un gasto operacional en efectivo cambia lo esperado en caja.
      invalidateCash(queryClient)
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.delete(`/expenses/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      invalidateCash(queryClient)
    },
  })
}
