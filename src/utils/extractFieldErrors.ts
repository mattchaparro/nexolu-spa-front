// Mapea los errores de validacion 422 de axios a {campo: primer mensaje},
// para pasarselos directo a la prop `error` de NxInput/NxInputNumber/
// NxSelect por campo - complementa extractErrorMessage.ts (que da un solo
// mensaje generico para banners).
export function extractFieldErrors(error: unknown): Record<string, string> {
  const response = (error as { response?: { data?: { errors?: Record<string, string[]> } } }).response
  const errors = response?.data?.errors
  if (!errors) {
    return {}
  }
  return Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, messages[0] ?? '']))
}
