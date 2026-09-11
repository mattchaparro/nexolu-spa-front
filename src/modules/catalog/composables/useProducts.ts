import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| Producto: catálogo, inventario y venta
|------------------------------------------------------------------------------
| La otra mitad del ingreso de un salón. En el sistema viejo existía y sus
| ventas no entraban en ningún reporte: $1.070.000 en año y medio invisibles.
*/

export interface AdminProduct {
  id: number
  name: string
  sku: string | null
  description: string | null
  image_url: string | null
  price: number
  cost: number | null
  stock: number
  low_stock_at: number | null
  /** Si hace falta reponer. Lo calcula el servidor. */
  is_low: boolean
  is_active: boolean
}

export function useProducts(onlyActive: Ref<boolean> | undefined = undefined) {
  return useQuery({
    queryKey: ['products', onlyActive ?? true],
    queryFn: async () =>
      (
        await httpClient.get<{ data: AdminProduct[]; low_stock: number }>('/products', {
          params: { only_active: (onlyActive?.value ?? true) ? 1 : 0 },
        })
      ).data,
  })
}

export function useSaveProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    // `FormData` y POST también al editar: el formulario manda la imagen como
    // multipart y PHP no puebla `$_FILES` en un PUT.
    mutationFn: async ({ id, payload }: { id?: number; payload: FormData }) =>
      (await httpClient.post(id ? `/products/${id}` : '/products', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useDeactivateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.delete(`/products/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

/** Entrada de mercancía, conteo o rotura. La cantidad va con signo. */
export function useAdjustStock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      id: number
      kind: 'entrada' | 'ajuste'
      quantity: number
      note?: string
    }) =>
      (
        await httpClient.post<{ stock: number }>(`/products/${payload.id}/stock`, {
          kind: payload.kind,
          quantity: payload.quantity,
          note: payload.note ?? null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

/**
 * Vender. `appointment_id` es opcional a propósito: hay quien entra sólo a
 * comprar una crema sin hacerse nada.
 */
export function useSellProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      id: number
      quantity: number
      appointment_id?: number | null
      client_id?: number | null
      payment_method_id?: number | null
      unit_price?: number | null
    }) =>
      (
        await httpClient.post<{ id: number; total: number; stock: number }>(
          `/products/${payload.id}/sell`,
          {
            quantity: payload.quantity,
            appointment_id: payload.appointment_id ?? null,
            client_id: payload.client_id ?? null,
            payment_method_id: payload.payment_method_id ?? null,
            unit_price: payload.unit_price ?? null,
          },
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      // El cierre del día cambia: la venta de producto es ingreso.
      queryClient.invalidateQueries({ queryKey: ['cash'] })
    },
  })
}

export interface ProductSaleRow {
  id: number
  product: string | null
  quantity: number
  total: number
  margin: number | null
  payment_method: string | null
  sold_at: string | null
}

export function useProductSales(from: Ref<string>, to: Ref<string>) {
  return useQuery({
    queryKey: ['products', 'sales', from, to],
    queryFn: async () =>
      (
        await httpClient.get<{ data: ProductSaleRow[]; total: number; units: number }>(
          '/products/sales',
          { params: { from: from.value, to: to.value } },
        )
      ).data,
  })
}
