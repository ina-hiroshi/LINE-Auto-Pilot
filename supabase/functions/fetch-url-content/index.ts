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

// Extract meta information from HTML (including Open Graph tags)
function extractMetaInfo(html: string): { title: string; description: string; keywords: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : '';
  
  // Try Open Graph title if regular title is empty
  if (!title) {
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    title = ogTitleMatch ? ogTitleMatch[1].trim() : '';
  }
  
  // Extract description (try multiple sources)
  let description = '';
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  description = descMatch ? descMatch[1].trim() : '';
  
  // Try Open Graph description
  if (!description) {
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
    description = ogDescMatch ? ogDescMatch[1].trim() : '';
  }
  
  // Extract keywords
  const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']keywords["']/i);
  const keywords = keywordsMatch ? keywordsMatch[1].trim() : '';
  
  return { title, description, keywords };
}

// Fallback text extraction when DOMParser fails
function extractTextFallback(html: string): string {
  // First, try to extract meta information
  const meta = extractMetaInfo(html);
  const metaParts: string[] = [];
  if (meta.title) metaParts.push(meta.title);
  if (meta.description) metaParts.push(meta.description);
  if (meta.keywords) metaParts.push(meta.keywords);
  
  // Extract text from HTML
  let text = html
    // Remove script tags and their content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Remove style tags and their content
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Extract alt attributes from images
    .replace(/<img[^>]*alt=["']([^"']+)["'][^>]*>/gi, ' $1 ')
    // Extract title attributes
    .replace(/<[^>]*title=["']([^"']+)["'][^>]*>/gi, ' $1 ')
    // Remove all HTML tags but preserve text content
    .replace(/<[^>]+>/g, ' ')
    // Decode HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#8217;/gi, "'")
    .replace(/&#8216;/gi, "'")
    .replace(/&#8220;/gi, '"')
    .replace(/&#8221;/gi, '"')
    .replace(/&#8211;/gi, '-')
    .replace(/&#8212;/gi, '--')
    .replace(/&hellip;/gi, '...')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // Combine meta info with extracted text
  const allText = [...metaParts, text].filter(t => t.length > 0).join(' ');
  
  // Less aggressive filtering - keep more text
  // Only filter out extremely short fragments
  const words = allText.split(/\s+/).filter(w => w.length > 0);
  const filteredText = words.join(' ').trim();
  
  return filteredText;
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
      console.log(`[fetch-url-content] HTML length: ${html.length} characters`);
      
      const doc = new DOMParser().parseFromString(html, "text/html");
      
      let title = url;
      let extractedText = '';

      if (doc) {
        title = doc.title || url;
        console.log(`[fetch-url-content] Document title: ${title}`);
        
        // Try to extract meta description first
        const metaDesc = doc.querySelector('meta[name="description"]');
        const metaDescription = metaDesc?.getAttribute('content') || '';
        
        // Remove script and style elements - cast to unknown first to bypass deno-dom type limitations
        const scripts = doc.querySelectorAll('script');
        scripts.forEach((node) => (node as unknown as { remove: () => void }).remove());
        const styles = doc.querySelectorAll('style');
        styles.forEach((node) => (node as unknown as { remove: () => void }).remove());
        
        extractedText = doc.body?.textContent || '';
        // Clean up whitespace
        extractedText = extractedText.replace(/\s+/g, ' ').trim();
        
        // If body text is empty but we have meta description, use that
        if (!extractedText && metaDescription) {
          extractedText = metaDescription;
        }
        
        // Combine title and description if body is empty
        if (!extractedText || extractedText.length < 10) {
          const parts: string[] = [];
          if (title && title !== url) parts.push(title);
          if (metaDescription) parts.push(metaDescription);
          if (parts.length > 0) {
            extractedText = parts.join(' ');
          }
        }
        
        console.log(`[fetch-url-content] DOMParser extracted: ${extractedText.length} characters`);
      } else {
        console.log('[fetch-url-content] DOMParser returned null');
      }

      // Fallback to regex-based extraction if DOMParser failed or extractedText is empty
      if (!extractedText || extractedText.length === 0) {
        console.log('[fetch-url-content] DOMParser failed or empty, using fallback extraction');
        extractedText = extractTextFallback(html);
        console.log(`[fetch-url-content] Fallback extracted: ${extractedText.length} characters`);
        
        // Update title from meta if we got it from fallback
        const meta = extractMetaInfo(html);
        if (meta.title && meta.title !== url) {
          title = meta.title;
        }
        
        // If we still have very little text but have meta description, use that
        if (extractedText.length < 50 && meta.description) {
          extractedText = meta.description;
        }
      }

      // Final check - if still empty, try to get at least title and description
      if (!extractedText || extractedText.trim().length === 0) {
        const meta = extractMetaInfo(html);
        const fallbackParts: string[] = [];
        if (meta.title && meta.title !== url) {
          fallbackParts.push(meta.title);
          title = meta.title;
        }
        if (meta.description) {
          fallbackParts.push(meta.description);
        }
        if (meta.keywords) {
          fallbackParts.push(meta.keywords);
        }
        
        if (fallbackParts.length > 0) {
          extractedText = fallbackParts.join(' ');
          console.log(`[fetch-url-content] Using meta information only: ${extractedText.length} characters`);
        }
      }

      // Final check - if still empty after all attempts, return error
      if (!extractedText || extractedText.trim().length === 0) {
        console.warn('[fetch-url-content] Could not extract text from URL:', url);
        console.warn('[fetch-url-content] HTML preview (first 1000 chars):', html.substring(0, 1000));
        return new Response(
          JSON.stringify({ error: 'このURLからテキストを抽出できませんでした。JavaScriptでレンダリングされるページ（SPA）の可能性があります。PDFファイルや静的HTMLページのURLをご利用ください。' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
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
