import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| Enlaces wa.me
|------------------------------------------------------------------------------
| Un nombre para reconocerlos y el mensaje con el que llega quien los toca.
| El enlace se arma acá con el número del negocio que devuelve el servidor
| (solo dígitos, con indicativo): guardar el enlace entero fijaría un número
| que después puede cambiar.
*/

export interface WhatsappLink {
  id: number
  name: string
  message: string
}

export interface WhatsappLinksPayload {
  /** Solo dígitos con indicativo, o null si el negocio no ha cargado su WhatsApp. */
  number: string | null
  links: WhatsappLink[]
}

/** `https://wa.me/57…?text=…`, o cadena vacía si falta el número. */
export function buildWhatsappUrl(number: string | null, message: string): string {
  const text = message.trim()

  if (!number) {
    return ''
  }

  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function useWhatsappLinks() {
  return useQuery({
    queryKey: ['whatsapp-links'],
    queryFn: async () => (await httpClient.get<WhatsappLinksPayload>('/whatsapp/links')).data,
  })
}

export function useSaveWhatsappLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...body }: { id?: number; name: string; message: string }) =>
      id
        ? (await httpClient.patch<WhatsappLink>(`/whatsapp/links/${id}`, body)).data
        : (await httpClient.post<WhatsappLink>('/whatsapp/links', body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-links'] }),
  })
}

export function useDeleteWhatsappLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.delete(`/whatsapp/links/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-links'] }),
  })
}
