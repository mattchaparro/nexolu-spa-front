import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

export interface ClientRow {
  id: number
  full_name: string
  phone: string | null
  email: string | null
  visits: number
  is_active: boolean
}

export interface HistoryItem {
  id: number
  service_name: string | null
  resource_name: string | null
  final_price: number | null
}

export interface HistoryEntry {
  id: number
  date: string
  time: string
  starts_at: string
  status: string
  is_paid: boolean
  total: number | null
  payment_method: string | null
  notes: string | null
  items: HistoryItem[]
}

export interface ClientPhoto {
  id: number
  url: string
  caption: string | null
  date: string
  service_name: string | null
}

export interface ClientStats {
  visits: number
  total_spent: number
  average_ticket: number
  no_shows: number
  first_visit: string | null
  last_visit: string | null
  favorite_service: string | null
  favorite_resource: string | null
  next_appointment: { id: number; starts_at: string; label: string } | null
}

export interface ClientProfile {
  id: number
  name: string
  last_name: string | null
  full_name: string
  phone: string | null
  email: string | null
  birth_date: string | null
  notes: string | null
  care_notes: string | null
  preferred_resource_id: number | null
  accepts_marketing: boolean
  is_active: boolean
  created_at: string | null
  stats: ClientStats
  history: HistoryEntry[]
  photos: ClientPhoto[]
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Sin confirmar',
  confirmed: 'Confirmada',
  in_progress: 'En curso',
  completed: 'Atendida',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
}

export function useClientList(term: Ref<string>) {
  return useQuery({
    queryKey: ['clients', 'list', term],
    queryFn: async () =>
      (
        await httpClient.get<{ data: ClientRow[]; meta: { total: number } }>('/clients', {
          params: { q: term.value },
        })
      ).data,
  })
}

export function useClientProfile(id: Ref<number | null>) {
  return useQuery({
    queryKey: ['clients', 'profile', id],
    enabled: () => id.value !== null,
    queryFn: async () => (await httpClient.get<ClientProfile>(`/clients/${id.value}`)).data,
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number } & Record<string, unknown>) =>
      (await httpClient.patch<ClientProfile>(`/clients/${id}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  })
}

export function useUploadPhoto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      clientId,
      file,
      caption,
      appointmentItemId,
    }: {
      clientId: number
      file: File
      caption?: string
      appointmentItemId?: number | null
    }) => {
      const form = new FormData()
      form.append('photo', file)
      if (caption) form.append('caption', caption)
      if (appointmentItemId) form.append('appointment_item_id', String(appointmentItemId))

      return (await httpClient.post(`/clients/${clientId}/photos`, form)).data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients', 'profile'] }),
  })
}

export function useDeletePhoto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.delete(`/clients/photos/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients', 'profile'] }),
  })
}
