// Using Deno.serve instead of @std/http/server
import { DOMParser } from "deno-dom";
import { encodeBase64 } from "@std/encoding/base64";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`Fetching URL: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    console.log(`Content-Type: ${contentType}`);

    if (contentType.includes('text/html')) {
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      
      let title = url;
      let extractedText = '';

      if (doc) {
        title = doc.title || url;
        // Remove script and style elements - cast to unknown first to bypass deno-dom type limitations
        const scripts = doc.querySelectorAll('script');
        scripts.forEach((node) => (node as unknown as { remove: () => void }).remove());
        const styles = doc.querySelectorAll('style');
        styles.forEach((node) => (node as unknown as { remove: () => void }).remove());
        
        extractedText = doc.body?.textContent || '';
        // Clean up whitespace
        extractedText = extractedText.replace(/\s+/g, ' ').trim();
      }

      return new Response(
        JSON.stringify({ type: 'text', title, content: extractedText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else if (contentType.includes('application/pdf')) {
      const arrayBuffer = await response.arrayBuffer();
      const base64 = encodeBase64(new Uint8Array(arrayBuffer));
      
      return new Response(
        JSON.stringify({ type: 'pdf', title: url.split('/').pop() || 'document.pdf', data: base64 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else if (contentType.includes('text/plain')) {
      const text = await response.text();
      return new Response(
        JSON.stringify({ type: 'text', title: url, content: text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported content type: ${contentType}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
