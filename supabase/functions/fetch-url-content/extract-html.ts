import { DOMParser } from 'deno-dom'

/** HTML の解釈を DOMParser に限定し、不正な HTML を正規表現で走査し直さない。 */
export function extractHtml(html: string, url: string): { title: string; content: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (!doc) throw new Error('HTML could not be parsed')
  const meta = (selector: string) => doc.querySelector(selector)?.getAttribute('content')?.trim() ?? ''
  const title = doc.title || meta('meta[property="og:title"]') || url
  const description = meta('meta[name="description"]') || meta('meta[property="og:description"]')
  const keywords = meta('meta[name="keywords"]')
  doc.querySelectorAll('script, style, noscript').forEach((node) => node.remove())
  let content = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (!content) content = [title === url ? '' : title, description, keywords].filter(Boolean).join(' ')
  return { title, content }
}
