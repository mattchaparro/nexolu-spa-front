/**
 * Trozos de texto del asistente, marcando cuál va en negrita.
 *
 * El modelo escribe `*cifra*` (como en WhatsApp) o `**cifra**`. Pintarlo crudo
 * deja los asteriscos a la vista. No se usa una librería de markdown con
 * v-html: lo que se inyectaría es la salida de un modelo de lenguaje, y un
 * `<img onerror=...>` ahí sería código corriendo en la sesión de la dueña.
 * Aquí nunca se genera HTML: la plantilla pinta trozos como texto.
 */
export interface RichTextChunk {
  text: string
  bold: boolean
}

const BOLD = /\*\*(.+?)\*\*|\*([^*\n]+?)\*/g

export function parseRichText(input: string): RichTextChunk[] {
  const chunks: RichTextChunk[] = []
  let lastIndex = 0

  for (const match of input.matchAll(BOLD)) {
    const start = match.index ?? 0

    if (start > lastIndex) {
      chunks.push({ text: input.slice(lastIndex, start), bold: false })
    }

    chunks.push({ text: match[1] ?? match[2] ?? '', bold: true })
    lastIndex = start + match[0].length
  }

  if (lastIndex < input.length) {
    chunks.push({ text: input.slice(lastIndex), bold: false })
  }

  return chunks.length > 0 ? chunks : [{ text: input, bold: false }]
}
