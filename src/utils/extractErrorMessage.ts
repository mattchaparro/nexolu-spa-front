/**
 * Primer mensaje de error util de una respuesta de axios: 422 de validacion,
 * o el mensaje generico bajo `message` (convencion default de Laravel) o
 * `error` (varios controllers de esta API devuelven {error: ...} en vez de
 * {message: ...} para fallos de gateway - ver SubscriptionController::initiate,
 * AiChatController::send).
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  const response = (
    error as { response?: { data?: { message?: string; error?: string; errors?: Record<string, string[]> } } }
  ).response
  const firstFieldError = response?.data?.errors
    ? Object.values(response.data.errors)[0]?.[0]
    : undefined
  return firstFieldError ?? response?.data?.message ?? response?.data?.error ?? fallback
}
