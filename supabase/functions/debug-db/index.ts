// Development/debug utility - minimal handler for deployment
Deno.serve(async () => {
  return new Response(JSON.stringify({ status: 'ok', message: 'debug-db placeholder' }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
