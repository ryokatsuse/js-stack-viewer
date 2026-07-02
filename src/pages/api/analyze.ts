import type { APIRoute } from 'astro'
import { analyze, AnalyzeError } from '../../lib/analyzer'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'リクエストボディはJSONで送ってください' }, 400)
  }

  const url = (body as { url?: unknown })?.url
  if (typeof url !== 'string' || url.trim() === '') {
    return json({ error: 'url を指定してください' }, 400)
  }

  try {
    const result = await analyze(url.trim())
    return json(result, 200)
  } catch (err) {
    if (err instanceof AnalyzeError) {
      return json({ error: err.message }, err.status)
    }
    if (err instanceof Error && err.name === 'TimeoutError') {
      return json({ error: '取得がタイムアウトしました。相手が重いか、防御が固い' }, 504)
    }
    console.error('[analyze] unexpected error:', err)
    return json({ error: '調べている途中で予期しないエラーが発生しました' }, 500)
  }
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
