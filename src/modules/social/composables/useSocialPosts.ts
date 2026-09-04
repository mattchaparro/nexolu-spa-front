import type { Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { httpClient } from '@/services/http/client'

/*
|------------------------------------------------------------------------------
| Publicaciones en redes
|------------------------------------------------------------------------------
| La bandeja y el calendario vienen en UNA sola respuesta porque en pantalla van
| juntos: dos cargas para pintar algo que se lee como una sola cosa obligarían a
| la vista a coordinarlas, y a mostrar media pantalla mientras llega la otra.
|
| No hay mutación que publique, y no es un olvido: el sistema no publica. Lo que
| hace el reloj del servidor es mover lo programado a «lista para publicar»
| cuando llega su hora; la última tecla la toca una persona. Ver
| docs/publicaciones.md en el API.
*/

/**
 * Una de las imágenes de una publicación.
 *
 * La PRIMERA es la portada: la única que se ve en la cuadrícula del perfil, y
 * la que decide si alguien abre la publicación. Por eso el orden se manda
 * explícito y la pantalla no reordena por su cuenta.
 */
export interface PostImage {
  id: number
  url: string | null
  client_photo_id: number | null
  from_client_photo: boolean
}

export interface SocialPost {
  id: number
  status: string
  status_label: string
  angle: string
  angle_label: string
  source: 'auto' | 'manual'
  /** De qué se trata, en una línea. Lo calcula el servidor. */
  headline: string
  caption: string | null
  hashtags: string[]
  /** Escrito por el asistente y todavía sin tocar por nadie. */
  written_by_assistant: boolean
  images: PostImage[]
  /** La portada, para las tarjetas del calendario. */
  image_url: string | null
  service_name: string | null
  location_name: string | null
  subject_date: string | null
  scheduled_for: string | null
  published_at: string | null
  approved_by: string | null
  /** Tiene texto e imagen: lo mínimo para poder programarse. */
  is_complete: boolean
  /**
   * Lo que Instagram rechazaría, dicho antes de intentarlo.
   *
   * Lo resuelve el servidor: la proporción se mide leyendo el archivo, y eso
   * la pantalla no lo puede saber.
   */
  rejected_reason: string | null
  error: string | null
}

export interface SocialAngle {
  value: string
  label: string
}

/**
 * Cómo está la conexión con Instagram.
 *
 * El token no viaja, obviamente. Lo que viaja es si se puede publicar y, si no,
 * por qué — «caducó» se arregla reconectando y «apagada» con un interruptor, y
 * un «no se puede» a secas manda a buscar el problema equivocado.
 */
export interface InstagramState {
  connected: boolean
  username: string | null
  can_publish: boolean
  /** Le quedan pocos días: el panel avisa antes de que deje de servir. */
  expires_soon: boolean
  reason: string | null
}

export interface SocialBoard {
  /** Ideas sin fecha, esperando que alguien las mire. */
  tray: SocialPost[]
  /** Lo que ya tiene fecha o ya salió. */
  calendar: SocialPost[]
  counts: { tray: number; ready: number }
  instagram: InstagramState
  angles: SocialAngle[]
}

/** Una foto de la ficha que la clienta autorizó publicar. */
export interface PublishablePhoto {
  id: number
  url: string
  date: string
  service_name: string | null
}

const KEY = ['social-posts']

export function useSocialBoard(locationId?: Ref<number | null>) {
  return useQuery({
    queryKey: [...KEY, 'board', locationId ?? null],
    queryFn: async () =>
      (
        await httpClient.get<SocialBoard>('/social-posts', {
          params: { ...(locationId?.value ? { location_id: locationId.value } : {}) },
        })
      ).data,
  })
}

/**
 * Las fotos que SE PUEDEN publicar.
 *
 * El servidor filtra por consentimiento y no acepta parámetro para saltárselo,
 * así que esta lista es literalmente todo lo disponible. Tampoco trae el nombre
 * de la clienta: quien arma la publicación no lo necesita.
 */
export function usePublishablePhotos(enabled: Ref<boolean>) {
  return useQuery({
    queryKey: [...KEY, 'photo-pool'],
    enabled: () => enabled.value,
    queryFn: async () =>
      (await httpClient.get<{ photos: PublishablePhoto[] }>('/social-posts/photo-pool')).data
        .photos,
  })
}

/** "Busca ideas ahora", para quien abre la pantalla y la encuentra vacía. */
export function usePlanPosts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () =>
      (await httpClient.post<{ proposed: number; message: string }>('/social-posts/plan')).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export interface PostDraft {
  angle?: string
  caption?: string | null
  hashtags?: string[]
  service_id?: number | null
  location_id?: number | null
  subject_date?: string | null

  /*
   * Las imágenes se mandan como LISTA COMPLETA, no se parchean una por una:
   * `keep_image_ids` son las que siguen —en el orden en que van— y las otras
   * dos se agregan al final. Con endpoints separados para agregar, quitar y
   * mover, quitar la del medio y reordenar las otras dos son tres llamadas,
   * cualquiera falla a mitad, y queda un carrusel que nadie pidió.
   *
   * `undefined` en las tres = no se tocan las imágenes.
   */
  keep_image_ids?: number[]
  client_photo_ids?: number[]
  images?: File[]
}

/**
 * Guardar es POST, también al editar.
 *
 * El formulario manda multipart por la imagen y PHP no puebla `$_FILES` en un
 * PUT — misma razón que en el catálogo. El `FormData` se arma acá y no en la
 * vista: es el tipo de código que se rompe en silencio (el formulario dice
 * "guardado", el servidor no cambia nada) y por eso tiene prueba propia.
 */
export function postFormData(draft: PostDraft): FormData {
  const form = new FormData()

  if (draft.angle) form.append('angle', draft.angle)

  // `?? ''` y no `if (caption)`: borrar el texto es una edición válida, y
  // saltársela dejaría el texto viejo en la base sin que nadie lo note.
  if (draft.caption !== undefined) form.append('caption', draft.caption ?? '')

  if (draft.hashtags) {
    // Vacío explícito: sin esto, quitar todas las etiquetas no manda el
    // campo y el servidor conserva las anteriores.
    if (draft.hashtags.length === 0) {
      form.append('hashtags[]', '')
    } else {
      draft.hashtags.forEach((tag) => form.append('hashtags[]', tag))
    }
  }

  if (draft.service_id !== undefined) form.append('service_id', String(draft.service_id ?? ''))
  if (draft.location_id !== undefined) form.append('location_id', String(draft.location_id ?? ''))
  if (draft.subject_date !== undefined) form.append('subject_date', draft.subject_date ?? '')

  /*
   * Lista vacía con centinela, por lo mismo que los hashtags: un arreglo
   * vacío no escribe NADA en un FormData, así que sin él "quitar todas las
   * imágenes" llegaría como "no me mandaste el campo" y el servidor las
   * conservaría. Quedarse sin poder vaciar el carrusel es peor que la fealdad
   * de esta línea.
   */
  if (draft.keep_image_ids !== undefined) {
    if (draft.keep_image_ids.length === 0) {
      form.append('keep_image_ids[]', '')
    } else {
      draft.keep_image_ids.forEach((id) => form.append('keep_image_ids[]', String(id)))
    }
  }

  draft.client_photo_ids?.forEach((id) => form.append('client_photo_ids[]', String(id)))
  draft.images?.forEach((file) => form.append('images[]', file))

  return form
}

/**
 * «Crear publicación» desde las fotos de un servicio.
 *
 * Cierra el círculo del módulo: la foto se tomó al cerrar el servicio, la
 * clienta dio permiso, y de ahí sale el borrador — con el servicio y la sede
 * de esa cita ya puestos.
 */
export function useCreateFromPhotos() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (clientPhotoIds: number[]) =>
      (
        await httpClient.post<{ post: SocialPost }>('/social-posts/from-photos', {
          client_photo_ids: clientPhotoIds,
        })
      ).data.post,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSavePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...draft }: { id?: number } & PostDraft) =>
      (
        await httpClient.post<{ post: SocialPost }>(
          id ? `/social-posts/${id}` : '/social-posts',
          postFormData(draft),
        )
      ).data.post,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/** "Escríbeme el texto." Una publicación a la vez, y sólo cuando se pide. */
export function useComposePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, extra }: { id: number; extra?: string }) =>
      (await httpClient.post<{ post: SocialPost }>(`/social-posts/${id}/compose`, { extra })).data
        .post,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/** Aprobar: ponerle fecha y sacarla de la bandeja. */
export function useSchedulePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, scheduledFor }: { id: number; scheduledFor: string }) =>
      (
        await httpClient.post<{ post: SocialPost }>(`/social-posts/${id}/schedule`, {
          scheduled_for: scheduledFor,
        })
      ).data.post,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/**
 * «Publícala ahora», contra Instagram de verdad.
 *
 * Sólo sirve si el negocio conectó su cuenta. Sin ella el camino sigue siendo
 * copiar, pegar y marcar — que no es un modo degradado, es como opera un spa
 * sus primeras semanas.
 */
export function usePublishNow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) =>
      (await httpClient.post<{ post: SocialPost }>(`/social-posts/${id}/publish`)).data.post,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/** "Ya la publiqué", a mano. Es el dato que el sistema no puede saber solo. */
export function useMarkPublished() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) =>
      (await httpClient.post<{ post: SocialPost }>(`/social-posts/${id}/published`)).data.post,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDiscardPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => (await httpClient.delete(`/social-posts/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
