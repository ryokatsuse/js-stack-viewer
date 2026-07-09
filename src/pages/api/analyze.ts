import type { APIRoute } from 'astro'
import { analyze, AnalyzeError } from '../../lib/analyzer'

export const prerender = false

/**
 * NDJSONでストリーミングするエンドポイント。
 * 進捗: {"stage":"fetchHtml"} のような行を処理の進行に合わせて送り、
 * 最後に {"result":{...}} か {"error":"...","status":n} を1行送って閉じる。
 */
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

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`))
      try {
        const result = await analyze(url.trim(), (stage) => send({ stage }))
        send({ result })
      } catch (err) {
        if (err instanceof AnalyzeError) {
          send({ error: err.message, status: err.status })
        } else if (err instanceof Error && err.name === 'TimeoutError') {
          send({
            error: '取得がタイムアウトしました。相手が重いか、防御が固い',
            status: 504,
          })
        } else {
          console.error('[analyze] unexpected error:', err)
          send({
            error: '調べている途中で予期しないエラーが発生しました',
            status: 500,
          })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      // nginx系プロキシにバッファリングさせない
      'x-accel-buffering': 'no',
    },
  })
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
