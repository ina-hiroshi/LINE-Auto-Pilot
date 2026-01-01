// Using Deno.serve instead of @std/http/server
import { DOMParser } from "deno-dom";
import { encodeBase64 } from "@std/encoding/base64";
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'

// URLホワイトリスト（許可するドメイン）
const ALLOWED_URL_PATTERNS = [
  /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b/,
];

// ブロックするドメイン（内部ネットワーク等）
const BLOCKED_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/\[fc00:/i,
  /^https?:\/\/\[fe80:/i,
];

function isUrlAllowed(url: string): boolean {
  // ブロックパターンに一致するか確認
  if (BLOCKED_PATTERNS.some(pattern => pattern.test(url))) {
    return false;
  }
  // 許可パターンに一致するか確認
  return ALLOWED_URL_PATTERNS.some(pattern => pattern.test(url));
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 認証チェック
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Valid authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { url } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // SSRF対策: URLの検証
    if (!isUrlAllowed(url)) {
      return new Response(
        JSON.stringify({ error: 'URL is not allowed. Internal network addresses are blocked.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    console.log(`[fetch-url-content] User ${user.id} fetching URL: ${url}`);
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
