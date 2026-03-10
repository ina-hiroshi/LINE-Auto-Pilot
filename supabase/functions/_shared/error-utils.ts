export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Unknown error'
}

/**
 * Logs the real error server-side and returns a generic message to the client.
 * Use `clientMessage` to override the user-facing text.
 */
export function safeErrorResponse(
  error: unknown,
  headers: Record<string, string>,
  statusCode = 500,
  clientMessage = 'Internal server error',
): Response {
  const internalMessage = toErrorMessage(error)
  console.error(`[Error ${statusCode}]`, internalMessage)

  return new Response(
    JSON.stringify({ error: clientMessage }),
    { status: statusCode, headers: { ...headers, 'Content-Type': 'application/json' } },
  )
}
