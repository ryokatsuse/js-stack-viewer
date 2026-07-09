import { createRequire } from 'node:module'
import { detect, type Finding } from './detectors'

// wakaruのESMビルドはprettier v2のサブパス解決に失敗するためCJSビルドを使う
const require = createRequire(import.meta.url)
const { unpack } = require('@wakaru/unpacker') as {
  unpack: (source: string) => {
    modules: Array<{
      id: string | number
      isEntry: boolean
      code: string
    }>
    moduleIdMapping: Record<string | number, string>
  }
}
const { runDefaultTransformationRules } = require('@wakaru/unminify') as {
  runDefaultTransformationRules: (fileInfo: {
    path: string
    source: string
  }) => Promise<{ path: string; code: string }>
}

const FETCH_TIMEOUT_MS = 20_000
/** JS/CSSなどサブリソースは短めに諦める (1本の遅いCDNで全体が待たされないように) */
const SUBRESOURCE_TIMEOUT_MS = 10_000
const MAX_HTML_BYTES = 3 * 1024 * 1024
const MAX_SCRIPT_BYTES = 8 * 1024 * 1024
const MAX_SCRIPTS = 10
const MAX_STYLESHEETS = 5
const MAX_CSS_BYTES = 2 * 1024 * 1024
/** これ以上デカいバンドルはunpackしない (CPU保護) */
const MAX_UNPACK_BYTES = 3 * 1024 * 1024
/** このサイズを超えるスクリプトは、バンドルの痕跡があるときだけunpackする */
const UNPACK_ALWAYS_BYTES = 512 * 1024
/** 主要バンドラのランタイムヘルパー。これが無い大きなスクリプトは分割できる見込みが薄い */
const BUNDLE_MARKERS =
  /webpackChunk|webpackJsonp|__webpack_require__|parcelRequire|__vitePreload|__vite__mapDeps|__toESM\s*=|__toCommonJS\s*=/
/** unminifyに食わせるモジュールコードの上限 */
const MAX_UNMINIFY_CHARS = 20_000
const MAX_PREVIEW_CHARS = 12_000

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 TechStackViewer/0.1'

export interface ScriptInfo {
  url: string
  bytes: number
  inline: boolean
  /** wakaruが分割できたモジュール数 (失敗/未実行はnull) */
  moduleCount: number | null
}

export interface AnalyzeResult {
  url: string
  fetchedAt: string
  scripts: ScriptInfo[]
  totalJsBytes: number
  findings: Finding[]
  /** wakaruでunminifyしたコードのプレビュー */
  preview: {
    scriptUrl: string
    moduleId: string | number
    code: string
    truncated: boolean
  } | null
}

export class AnalyzeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}

function assertSafeUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new AnalyzeError('URLの形式が正しくありません')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AnalyzeError('http / https のURLだけ調べられます')
  }
  if (process.env.ALLOW_LOCAL === '1') return url
  const host = url.hostname.toLowerCase()
  const privatePatterns = [
    /^localhost$/,
    /\.local$/,
    /^127\./,
    /^0\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^169\.254\./,
    /^\[?::1\]?$/,
    /^\[?fc/i,
    /^\[?fe80/i,
  ]
  if (privatePatterns.some((p) => p.test(host))) {
    throw new AnalyzeError('ローカル/プライベートなアドレスは調べられません')
  }
  return url
}

async function fetchText(
  url: string,
  maxBytes: number,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<{ text: string; headers: Record<string, string> }> {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    throw new AnalyzeError(`${url} の取得に失敗しました (HTTP ${res.status})`, 502)
  }
  const headers: Record<string, string> = {}
  res.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v
  })

  // サイズ上限を守りながら読む
  const reader = res.body?.getReader()
  if (!reader) return { text: await res.text(), headers }
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    chunks.push(value)
    if (total > maxBytes) {
      await reader.cancel()
      break
    }
  }
  const buf = Buffer.concat(chunks)
  return { text: buf.toString('utf-8'), headers }
}

interface ExtractedScripts {
  external: string[]
  inline: string[]
}

function extractScripts(html: string, baseUrl: URL): ExtractedScripts {
  const external: string[] = []
  const inline: string[] = []
  const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = scriptTag.exec(html)) !== null) {
    const attrs = m[1] ?? ''
    const body = m[2] ?? ''
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)
    if (srcMatch) {
      try {
        const resolved = new URL(srcMatch[1]!, baseUrl).toString()
        if (!external.includes(resolved)) external.push(resolved)
      } catch {
        /* 不正なsrcは無視 */
      }
    } else if (body.trim().length > 0) {
      const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]
      if (type && !/javascript|module/i.test(type)) continue
      inline.push(body)
    }
  }
  // Viteが使うmodulepreloadも拾う
  const preload =
    /<link\b[^>]*rel\s*=\s*["']modulepreload["'][^>]*href\s*=\s*["']([^"']+)["']/gi
  while ((m = preload.exec(html)) !== null) {
    try {
      const resolved = new URL(m[1]!, baseUrl).toString()
      if (!external.includes(resolved)) external.push(resolved)
    } catch {
      /* ignore */
    }
  }
  return { external: external.slice(0, MAX_SCRIPTS), inline }
}

/** TailwindなどCSSにしか痕跡が残らないものを検出するためスタイルシートも取得する */
function extractStylesheets(html: string, baseUrl: URL): string[] {
  const urls: string[] = []
  const linkTag = /<link\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = linkTag.exec(html)) !== null) {
    const tag = m[0]
    if (!/\brel\s*=\s*["']?stylesheet["']?/i.test(tag)) continue
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
    if (!href) continue
    try {
      const resolved = new URL(href, baseUrl).toString()
      if (!urls.includes(resolved)) urls.push(resolved)
    } catch {
      /* 不正なhrefは無視 */
    }
  }
  return urls.slice(0, MAX_STYLESHEETS)
}

function tryUnpack(source: string) {
  if (source.length > MAX_UNPACK_BYTES) return null
  // 大きいのにバンドラの痕跡がないスクリプト (アナリティクスSDKなど) は
  // パースしても分割できないので、CPUの浪費を避けてスキップする
  if (source.length > UNPACK_ALWAYS_BYTES && !BUNDLE_MARKERS.test(source))
    return null
  try {
    return unpack(source)
  } catch {
    return null
  }
}

async function tryUnminify(
  moduleId: string | number,
  code: string,
): Promise<string | null> {
  try {
    const input = code.slice(0, MAX_UNMINIFY_CHARS)
    const out = await runDefaultTransformationRules({
      path: `module-${moduleId}.js`,
      source: input,
    })
    return out.code
  } catch {
    return null
  }
}

/** 解析の進捗ステージ。UI表示の文言はmessages.tsのloadingMessagesで定義する */
export type AnalyzeStage =
  | 'fetchHtml'
  | 'extractScripts'
  | 'fetchResources'
  | 'detect'
  | 'unpack'
  | 'unminify'

/**
 * 進捗イベントをレスポンスに書き出す時間を確保するため、
 * CPUを長く占有する同期処理の前にイベントループへ制御を返す
 */
const yieldToEventLoop = () => new Promise<void>((r) => setImmediate(r))

export async function analyze(
  rawUrl: string,
  onProgress?: (stage: AnalyzeStage) => void,
): Promise<AnalyzeResult> {
  const url = assertSafeUrl(rawUrl)

  onProgress?.('fetchHtml')
  let html: string
  let headers: Record<string, string>
  try {
    ;({ text: html, headers } = await fetchText(url.toString(), MAX_HTML_BYTES))
  } catch (err) {
    if (err instanceof AnalyzeError) throw err
    if (err instanceof Error && err.name === 'TimeoutError') throw err
    throw new AnalyzeError('サイトに接続できませんでした。URLを確認してください', 502)
  }
  onProgress?.('extractScripts')
  const { external, inline } = extractScripts(html, url)

  const scriptContents: Array<{ url: string; content: string; inline: boolean }> =
    inline.length > 0
      ? [{ url: '(inline script)', content: inline.join('\n;\n'), inline: true }]
      : []

  // I/O待ちが大半なので並列で取得 (スクリプトとCSSをまとめて)
  onProgress?.('fetchResources')
  const stylesheetUrls = extractStylesheets(html, url)
  const CONCURRENCY = 8
  const queue: Array<{ url: string; kind: 'js' | 'css' }> = [
    ...external.map((u) => ({ url: u, kind: 'js' as const })),
    ...stylesheetUrls.map((u) => ({ url: u, kind: 'css' as const })),
  ]
  const fetchedJs: Array<{ url: string; content: string }> = []
  const fetchedCss: Array<{ url: string; content: string }> = []
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (;;) {
        const next = queue.shift()
        if (!next) return
        try {
          const max = next.kind === 'js' ? MAX_SCRIPT_BYTES : MAX_CSS_BYTES
          const { text } = await fetchText(next.url, max, SUBRESOURCE_TIMEOUT_MS)
          ;(next.kind === 'js' ? fetchedJs : fetchedCss).push({
            url: next.url,
            content: text,
          })
        } catch {
          /* 取れないリソースはスキップ */
        }
      }
    }),
  )
  // 取得順ではなくHTML内の出現順に戻す
  fetchedJs.sort((a, b) => external.indexOf(a.url) - external.indexOf(b.url))
  for (const f of fetchedJs) scriptContents.push({ ...f, inline: false })

  // スクリプトが1つもなくてもHTMLとヘッダだけで判定できるものはある
  onProgress?.('detect')
  await yieldToEventLoop()
  const findings = detect({
    html,
    headers,
    scripts: scriptContents.map(({ url, content }) => ({ url, content })),
    styles: fetchedCss,
    pageUrl: url.toString(),
  })

  // wakaruでunpackしてモジュール数を数え、一番モジュールが多いバンドルを主犯とみなす
  onProgress?.('unpack')
  const scripts: ScriptInfo[] = []
  let best: {
    scriptUrl: string
    modules: Array<{ id: string | number; isEntry: boolean; code: string }>
  } | null = null
  for (const s of scriptContents) {
    await yieldToEventLoop()
    const unpacked = tryUnpack(s.content)
    const moduleCount = unpacked ? unpacked.modules.length : null
    scripts.push({
      url: s.url,
      bytes: Buffer.byteLength(s.content),
      inline: s.inline,
      moduleCount,
    })
    if (unpacked && unpacked.modules.length > (best?.modules.length ?? 0)) {
      best = { scriptUrl: s.url, modules: unpacked.modules }
    }
  }

  // プレビュー: エントリモジュール優先、なければ中身のある最大モジュール
  let preview: AnalyzeResult['preview'] = null
  if (best) {
    const candidate =
      best.modules.find((m) => m.isEntry && m.code.trim().length > 40) ??
      [...best.modules].sort((a, b) => b.code.length - a.code.length)[0]
    if (candidate && candidate.code.trim().length > 0) {
      onProgress?.('unminify')
      await yieldToEventLoop()
      const code = await tryUnminify(candidate.id, candidate.code)
      if (code) {
        preview = {
          scriptUrl: best.scriptUrl,
          moduleId: candidate.id,
          code: code.slice(0, MAX_PREVIEW_CHARS),
          truncated: code.length > MAX_PREVIEW_CHARS,
        }
      }
    }
  }

  return {
    url: url.toString(),
    fetchedAt: new Date().toISOString(),
    scripts,
    totalJsBytes: scripts.reduce((acc, s) => acc + s.bytes, 0),
    findings,
    preview,
  }
}
