import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

export interface ServiceAssignment {
  resource_id: number
  duration_override_min?: number | null
  commission_rate_override?: number | null
}

export interface AdminService {
  id: number
  name: string
  slug: string
  description: string | null
  image_url: string | null
  duration_min: number
  buffer_before_min: number
  buffer_after_min: number
  occupied_min: number
  price: number
  is_bookable_online: boolean
  is_active: boolean
  resource_ids?: number[]
}

export interface TeamResource {
  id: number
  type: 'staff' | 'station' | 'room' | 'equipment'
  name: string
  color: string | null
  photo_url: string | null
  user_id: number | null
  is_bookable_online: boolean
  is_active: boolean
}

export interface Schedule {
  id?: number
  weekday: number
  start_time: string
  end_time: string
}

export const WEEKDAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
] as const

export function useAdminServices(onlyActive = false) {
  return useQuery({
    queryKey: ['services', 'admin', onlyActive],
    queryFn: async () =>
      (await httpClient.get<AdminService[]>('/services', { params: { only_active: onlyActive } })).data,
  })
}

export function useTeam() {
  return useQuery({
    queryKey: ['resources', 'admin'],
    queryFn: async () =>
      (await httpClient.get<TeamResource[]>('/resources', { params: { only_active: false } })).data,
  })
}

export function useSchedules(resourceId: Ref<number | null>) {
  return useQuery({
    queryKey: ['schedules', resourceId],
    enabled: () => resourceId.value !== null,
    queryFn: async () =>
      (await httpClient.get<Schedule[]>(`/resources/${resourceId.value}/schedules`)).data,
  })
}

/**
 * Un servicio se manda como multipart siempre, no solo cuando hay imagen.
 *
 * Mezclar JSON y multipart segun el caso obliga a que el backend acepte los
 * dos formatos para la misma ruta, y ahi es donde se cuelan diferencias de
 * tipos: en multipart todo llega como texto, incluidos los booleanos.
 */
function serviceFormData(payload: Record<string, unknown>, image?: File | null): FormData {
  const form = new FormData()

  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) {
      continue
    }

    if (key === 'resources' && Array.isArray(value)) {
      value.forEach((row, i) => {
        const assignment = row as ServiceAssignment
        form.append(`resources[${i}][resource_id]`, String(assignment.resource_id))
        if (assignment.duration_override_min != null) {
          form.append(`resources[${i}][duration_override_min]`, String(assignment.duration_override_min))
        }
        if (assignment.commission_rate_override != null) {
          form.append(`resources[${i}][commission_rate_override]`, String(assignment.commission_rate_override))
        }
      })
      continue
    }

    // Laravel lee "1"/"0" como booleano; "true"/"false" no.
    form.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }

  if (image) {
    form.append('image', image)
  }

  return form
}

export function useSaveService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
      image,
    }: {
      id?: number
      payload: Record<string, unknown>
      image?: File | null
    }) => {
      const url = id ? `/services/${id}` : '/services'
      return (await httpClient.post<AdminService>(url, serviceFormData(payload, image))).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      // La disponibilidad depende de la duracion y de quien presta el
      // servicio: cambiar cualquiera de las dos la invalida.
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

export function useDeactivateService() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.delete(`/services/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

export function useSaveResource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
      photo,
    }: {
      id?: number
      payload: Record<string, unknown>
      photo?: File | null
    }) => {
      const form = new FormData()

      for (const [key, value] of Object.entries(payload)) {
        if (value === null || value === undefined || value === '') {
          continue
        }
        form.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
      }

      if (photo) {
        form.append('photo', photo)
      }

      const url = id ? `/resources/${id}` : '/resources'
      return (await httpClient.post<TeamResource>(url, form)).data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

export function useSaveSchedules() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ resourceId, schedules }: { resourceId: number; schedules: Schedule[] }) =>
      (await httpClient.put<Schedule[]>(`/resources/${resourceId}/schedules`, { schedules })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}
