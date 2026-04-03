/** クライアントにそのまま返してよいメッセージ（HTTP ステータス付き） */
export class ClientVisibleError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'ClientVisibleError'
    this.statusCode = statusCode
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Unknown error'
}

/**
 * Logs the real error server-side; returns a generic `clientMessage` to the client
 * (production-safe). Use `ClientVisibleError` for intentional user-facing messages.
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

export function clientVisibleErrorResponse(
  error: ClientVisibleError,
  corsHeaders: Record<string, string>,
): Response {
  console.error(`[Error ${error.statusCode}]`, error.message)
  return new Response(
    JSON.stringify({ error: error.message }),
    { status: error.statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}
