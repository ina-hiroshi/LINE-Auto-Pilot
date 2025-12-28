import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
        // Remove script and style elements
        const scripts = doc.querySelectorAll('script');
        scripts.forEach((node: any) => node.remove());
        const styles = doc.querySelectorAll('style');
        styles.forEach((node: any) => node.remove());
        
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
      const base64 = encode(new Uint8Array(arrayBuffer));
      
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

  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
