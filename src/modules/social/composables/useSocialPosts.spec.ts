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

  it('desligar una foto de la ficha se manda, no se omite', () => {
    // Quitarle la imagen a una publicación es lo que hay que hacer cuando la
    // clienta retira el permiso desde el mostrador.
    const form = postFormData({ client_photo_id: null })

    expect(form.get('client_photo_id')).toBe('')
  })

  it('adjunta la imagen sólo cuando hay una nueva', () => {
    const foto = new File(['x'], 'unas.jpg', { type: 'image/jpeg' })

    expect(postFormData({ image: foto }).has('image')).toBe(true)
    expect(postFormData({ image: null }).has('image')).toBe(false)
    expect(postFormData({}).has('image')).toBe(false)
  })
})
