import { describe, expect, it } from 'vitest'

import { postFormData } from './useSocialPosts'

/**
 * El multipart de una publicación.
 *
 * Mismo riesgo que el de un recurso o un gasto, y la misma razón para probarlo:
 * cuando esto se rompe, la pantalla dice "guardada", el servidor no cambia nada
 * y sólo se descubre volviendo a abrirla. Un typecheck no ve nada de esto.
 *
 * Acá hay además dos casos propios que un borrado normal no tiene: borrar el
 * texto y quitar TODAS las etiquetas. Los dos son ediciones legítimas y los dos
 * se ven, desde el lado del servidor, exactamente igual que "no me mandaste
 * ese campo" si se omiten.
 */
describe('postFormData', () => {
  it('manda el texto vacío en vez de omitirlo', () => {
    // Borrar el texto es una edición válida. Omitirlo dejaría el texto viejo
    // en la base y la persona creería haberlo borrado.
    const form = postFormData({ caption: '' })

    expect(form.has('caption')).toBe(true)
    expect(form.get('caption')).toBe('')
  })

  it('distingue borrar el texto de no preguntarlo', () => {
    // `undefined` es "esta pantalla no toca ese campo", que no es lo mismo
    // que "lo dejaron vacío a propósito".
    const form = postFormData({ angle: 'libre' })

    expect(form.has('caption')).toBe(false)
    expect(form.get('angle')).toBe('libre')
  })

  it('manda las etiquetas una por una', () => {
    const form = postFormData({ hashtags: ['#unas', '#bogota'] })

    expect(form.getAll('hashtags[]')).toEqual(['#unas', '#bogota'])
  })

  it('quitar todas las etiquetas llega como una lista vacía', () => {
    /*
     * Un arreglo vacío no escribe NADA en un FormData, así que sin el
     * centinela el servidor no vería el campo y conservaría las etiquetas
     * anteriores: quitarlas todas sería imposible desde la pantalla.
     *
     * El servidor limpia la entrada vacía al normalizar (ver
     * SocialPostController::normalizeHashtags), así que lo que queda guardado
     * es una lista vacía de verdad.
     */
    const form = postFormData({ hashtags: [] })

    expect(form.has('hashtags[]')).toBe(true)
    expect(form.getAll('hashtags[]')).toEqual([''])
  })

  it('vaciar el carrusel llega como una lista vacía', () => {
    /*
     * Mismo centinela que los hashtags, y por lo mismo: un arreglo vacío no
     * escribe nada en un FormData, así que sin él "quitar todas las imágenes"
     * llegaría como "no me mandaste el campo" y el servidor las conservaría.
     * Quedarse sin poder vaciar el carrusel es peor que la fealdad de la línea.
     */
    const form = postFormData({ keep_image_ids: [] })

    expect(form.has('keep_image_ids[]')).toBe(true)
    expect(form.getAll('keep_image_ids[]')).toEqual([''])
  })

  it('conserva el orden de las imágenes que siguen', () => {
    // La primera es la portada: si el orden se pierde en el camino, la
    // publicación sale con otra cara en la cuadrícula del perfil.
    const form = postFormData({ keep_image_ids: [7, 3, 9] })

    expect(form.getAll('keep_image_ids[]')).toEqual(['7', '3', '9'])
  })

  it('no toca las imágenes si no se dice nada de ellas', () => {
    // Guardar sólo el texto no puede vaciar el carrusel. Es el error
    // silencioso que este módulo no se puede permitir.
    const form = postFormData({ caption: 'Otro texto.' })

    expect(form.has('keep_image_ids[]')).toBe(false)
    expect(form.has('client_photo_ids[]')).toBe(false)
    expect(form.has('images[]')).toBe(false)
  })

  it('las fotos de ficha y los archivos se agregan al final', () => {
    const foto = new File(['x'], 'unas.jpg', { type: 'image/jpeg' })
    const form = postFormData({ client_photo_ids: [4, 5], images: [foto] })

    expect(form.getAll('client_photo_ids[]')).toEqual(['4', '5'])
    expect(form.getAll('images[]')).toHaveLength(1)
  })
})
