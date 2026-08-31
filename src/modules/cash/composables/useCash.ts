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
  location_id: number | null
  already_closed: boolean
  pending_dates: string[]
}

export interface Closing {
  id: number
  date: string
  location_id: number | null
  location_name: string | null
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
  location_id: number | null
  /** Nulo = del negocio entero. No es un dato faltante, es una decisión. */
  location_name: string | null
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
    // `location_id` sólo hace falta cuando quien abre puede estar en varios
    // cajones. Con una sede, o con una sola asignada, el servidor la deduce.
    mutationFn: async (payload: {
      opening_cash: number
      note?: string
      location_id?: number | null
    }) => (await httpClient.post<Shift>('/cash/shift/open', payload)).data,
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

/**
 * La vista previa del cierre, de UN cajón.
 *
 * Con dos sedes el servidor exige `location_id` -- incluso acá, en la vista
 * previa: enseñar un cuadre que después no se va a poder confirmar es peor que
 * preguntar antes. La consulta se desactiva mientras no haya sede elegida para
 * no disparar un 422 predecible en cada render.
 */
export function useClosingPreview(date: Ref<string>, locationId: Ref<number | null>) {
  return useQuery({
    queryKey: ['cash', 'closing-preview', date, locationId],
    // Un 422 "dinos en qué sede" es una respuesta legítima, no una falla de
    // red: reintentarla sólo la repite.
    retry: false,
    queryFn: async () =>
      (
        await httpClient.get<ClosingPreview>('/cash/closing/preview', {
          params: {
            date: date.value,
            ...(locationId.value ? { location_id: locationId.value } : {}),
          },
        })
      ).data,
  })
}

export function useClosings(locationId?: Ref<number | null>) {
  return useQuery({
    queryKey: ['cash', 'closings', locationId ?? null],
    queryFn: async () =>
      (
        await httpClient.get<Closing[]>('/cash/closings', {
          params: locationId?.value ? { location_id: locationId.value } : {},
        })
      ).data,
  })
}

export function useCloseDay() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      date: string
      actual_cash: number
      note?: string
      location_id?: number | null
    }) => (await httpClient.post<Closing>('/cash/closing', payload)).data,
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

/**
 * El resumen del día. Acá SÍ se puede mirar todo junto, a diferencia del
 * cierre: no se cuadra contra un cajón, responde "cómo nos fue hoy", y para el
 * dueño de dos locales esa pregunta es de los dos.
 */
export function useDailySummary(date: Ref<string>, locationId?: Ref<number | null>) {
  return useQuery({
    queryKey: ['daily-summary', date, locationId ?? null],
    queryFn: async () =>
      (
        await httpClient.get<DailySummary>('/daily-summary', {
          params: {
            date: date.value,
            ...(locationId?.value ? { location_id: locationId.value } : {}),
          },
        })
      ).data,
  })
}

export function useExpenses(from: Ref<string>, to: Ref<string>, locationId?: Ref<number | null>) {
  return useQuery({
    queryKey: ['expenses', from, to, locationId ?? null],
    queryFn: async () =>
      (
        await httpClient.get<{
          data: ExpenseRow[]
          totals: { operacional: number; administrativo: number; total: number }
        }>('/expenses', {
          params: {
            from: from.value,
            to: to.value,
            ...(locationId?.value ? { location_id: locationId.value } : {}),
          },
        })
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

      /*
       * `null` SÍ viaja, como cadena vacía; sólo se omite lo que no se mandó.
       *
       * Laravel convierte la cadena vacía en null antes de validar, así que el
       * servidor puede distinguir "no me lo preguntaron" de "dijeron que no es
       * de ningún local" -- que es justo lo que decide si un gasto entra en el
       * cierre de una caja o en ninguna. Omitir los nulos borraba esa
       * diferencia y volvía imposible marcar un gasto como del negocio entero.
       */
      for (const [key, value] of Object.entries(payload)) {
        if (value === undefined) continue
        form.append(key, value === null ? '' : String(value))
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
