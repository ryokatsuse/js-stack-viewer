/**
 * 本番バンドル / HTML / レスポンスヘッダから技術スタックの痕跡を探す
 * シグネチャ辞書。minify後も生き残る文字列リテラルやグローバル名を狙う。
 * 表示する説明文はmessages.tsで定義する。
 */
import { QUIPS, HEADER_QUIPS } from './messages'

export type Category =
  | 'bundler'
  | 'framework'
  | 'ui'
  | 'library'
  | 'analytics'
  | 'infra'

export interface Finding {
  id: string
  name: string
  category: Category
  /** 検出バージョン (取れた場合のみ) */
  version?: string
  /** バージョンが推定値かどうか */
  versionGuessed?: boolean
  /** 検出内容の説明文 (messages.tsで定義) */
  quip: string
  /** 何を根拠に検出したか */
  evidence: string
}

interface Signature {
  id: string
  name: string
  category: Category
  /** 'js' = バンドル本体, 'html' = ドキュメント, 'both' = 両方 */
  scope: 'js' | 'html' | 'both'
  test: RegExp
  /** マッチしたソースからバージョンを引き抜く */
  version?: (source: string) => { value: string; guessed: boolean } | undefined
  /** このシグネチャが当たったら除外するシグネチャID (より弱い汎用判定) */
  supersedes?: string[]
}

const exact = (value: string) => ({ value, guessed: false })
const guessed = (value: string) => ({ value, guessed: true })

const SIGNATURES: Signature[] = [
  // ---- bundler ----
  {
    id: 'webpack5',
    name: 'webpack 5',
    category: 'bundler',
    scope: 'js',
    test: /(?:self|window|globalThis)\.webpackChunk/,
    supersedes: ['webpack'],
  },
  {
    id: 'webpack4',
    name: 'webpack 4',
    category: 'bundler',
    scope: 'js',
    test: /webpackJsonp/,
    supersedes: ['webpack'],
  },
  {
    id: 'webpack',
    name: 'webpack',
    category: 'bundler',
    scope: 'js',
    test: /__webpack_require__|__webpack_exports__/,
  },
  {
    id: 'vite',
    name: 'Vite (Rollup)',
    category: 'bundler',
    scope: 'both',
    test: /__vitePreload|__vite__mapDeps|__vite_legacy_guard/,
  },
  {
    id: 'parcel',
    name: 'Parcel',
    category: 'bundler',
    scope: 'js',
    test: /parcelRequire/,
  },
  {
    id: 'esbuild',
    name: 'esbuild',
    category: 'bundler',
    scope: 'js',
    test: /var __toESM\s*=|var __toCommonJS\s*=|__esbuild/,
  },
  // ---- framework (メタフレームワーク / CMS) ----
  {
    id: 'nextjs',
    name: 'Next.js',
    category: 'framework',
    scope: 'both',
    test: /__NEXT_DATA__|\/_next\/static\/|__next_f/,
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    category: 'framework',
    scope: 'both',
    test: /window\.__NUXT__|\/_nuxt\//,
  },
  {
    id: 'gatsby',
    name: 'Gatsby',
    category: 'framework',
    scope: 'both',
    test: /___gatsby|___chunkMapping/,
  },
  {
    id: 'remix',
    name: 'Remix / React Router',
    category: 'framework',
    scope: 'both',
    test: /__remixContext|__reactRouterContext/,
  },
  {
    id: 'sveltekit',
    name: 'SvelteKit',
    category: 'framework',
    scope: 'both',
    test: /__sveltekit_/,
  },
  {
    id: 'astro',
    name: 'Astro',
    category: 'framework',
    scope: 'html',
    test: /<astro-island|astro-static-slot/,
  },
  {
    id: 'angular',
    name: 'Angular',
    category: 'framework',
    scope: 'html',
    test: /ng-version="[\d.]+"/,
    version: (src) => {
      const m = src.match(/ng-version="([\d.]+)"/)
      return m ? exact(m[1]!) : undefined
    },
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    category: 'framework',
    scope: 'html',
    test: /\/wp-content\/|\/wp-includes\//,
  },
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'framework',
    scope: 'both',
    test: /cdn\.shopify\.com|Shopify\.theme/,
  },
  // ---- UI library ----
  {
    id: 'react',
    name: 'React',
    category: 'ui',
    scope: 'js',
    test: /["']react\.element["']|["']react\.transitional\.element["']|__REACT_DEVTOOLS_GLOBAL_HOOK__/,
    version: (src) => {
      // react-dom がDevTools hookに登録する正確なバージョン
      let m = src.match(
        /version:\s*["'](\d+\.\d+\.\d+[^"']*)["']\s*,\s*rendererPackageName:\s*["']react-dom["']/,
      )
      if (m) return exact(m[1]!)
      m = src.match(
        /rendererPackageName:\s*["']react-dom["']\s*,\s*version:\s*["'](\d+\.\d+\.\d+[^"']*)["']/,
      )
      if (m) return exact(m[1]!)
      m = src.match(/reconcilerVersion[^"']*["'](\d+\.\d+\.\d+[^"']*)["']/)
      if (m) return guessed(m[1]!)
      return undefined
    },
  },
  {
    id: 'react19',
    name: 'React 19系',
    category: 'ui',
    scope: 'js',
    test: /["']react\.transitional\.element["']/,
  },
  {
    id: 'vue',
    name: 'Vue',
    category: 'ui',
    scope: 'js',
    test: /__v_isRef|__v_skip|_isVue\b/,
  },
  {
    id: 'preact',
    name: 'Preact',
    category: 'ui',
    scope: 'js',
    test: /__PREACT_DEVTOOLS__|preact\/compat/,
  },
  {
    id: 'svelte',
    name: 'Svelte',
    category: 'ui',
    scope: 'both',
    test: /\.svelte-[a-z0-9]+/,
  },
  {
    id: 'jquery',
    name: 'jQuery',
    category: 'ui',
    scope: 'js',
    test: /jQuery v\d|fn\.jquery\s*=|jquery\.org\/license/i,
    version: (src) => {
      let m = src.match(/jQuery v(\d+\.\d+[\d.]*)/)
      if (m) return exact(m[1]!)
      m = src.match(/fn\.jquery\s*=\s*["']([\d.]+)["']/)
      if (m) return exact(m[1]!)
      return undefined
    },
  },
  // ---- library ----
  {
    id: 'lodash',
    name: 'Lodash',
    category: 'library',
    scope: 'js',
    test: /__lodash_hash_undefined__/,
  },
  {
    id: 'moment',
    name: 'Moment.js',
    category: 'library',
    scope: 'js',
    test: /_isAMomentObject/,
  },
  {
    id: 'dayjs',
    name: 'Day.js',
    category: 'library',
    scope: 'js',
    test: /\$isDayjsObject/,
  },
  {
    id: 'axios',
    name: 'Axios',
    category: 'library',
    scope: 'js',
    test: /isAxiosError/,
  },
  {
    id: 'corejs',
    name: 'core-js',
    category: 'library',
    scope: 'js',
    test: /__core-js_shared__|core-js\//,
  },
  {
    id: 'styled-components',
    name: 'styled-components',
    category: 'library',
    scope: 'both',
    test: /styled-components|sc-component-id/,
  },
  {
    id: 'emotion',
    name: 'Emotion',
    category: 'library',
    scope: 'both',
    test: /data-emotion|@emotion\//,
  },
  {
    id: 'tailwind',
    name: 'Tailwind CSS',
    category: 'library',
    scope: 'both',
    test: /--tw-[a-z-]+/,
  },
  {
    id: 'zonejs',
    name: 'zone.js',
    category: 'library',
    scope: 'js',
    test: /__zone_symbol__|Zone\.__load_patch/,
  },
  {
    id: 'graphql',
    name: 'GraphQLクライアント',
    category: 'library',
    scope: 'js',
    test: /__typename/,
  },
  {
    id: 'socketio',
    name: 'Socket.IO',
    category: 'library',
    scope: 'js',
    test: /engine\.io|socket\.io/,
  },
  {
    id: 'firebase',
    name: 'Firebase',
    category: 'library',
    scope: 'js',
    test: /@firebase\/|firebaseio\.com|firebaseapp\.com/,
  },
  // ---- analytics / monitoring ----
  {
    id: 'ga',
    name: 'Google Analytics (gtag)',
    category: 'analytics',
    scope: 'both',
    test: /googletagmanager\.com\/gtag|[^\w]gtag\(/,
  },
  {
    id: 'gtm',
    name: 'Google Tag Manager',
    category: 'analytics',
    scope: 'both',
    test: /googletagmanager\.com\/gtm\.js|["']GTM-[A-Z0-9]{4,}["']/,
  },
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'analytics',
    scope: 'js',
    test: /__SENTRY__|ingest\.sentry\.io|sentry\.io\/api/,
  },
  {
    id: 'datadog',
    name: 'Datadog RUM',
    category: 'analytics',
    scope: 'js',
    test: /datadoghq|DD_RUM/,
  },
  {
    id: 'newrelic',
    name: 'New Relic',
    category: 'analytics',
    scope: 'js',
    test: /NREUM|newrelic\.com/,
  },
  {
    id: 'hotjar',
    name: 'Hotjar',
    category: 'analytics',
    scope: 'both',
    test: /hotjar/i,
  },
  {
    id: 'clarity',
    name: 'Microsoft Clarity',
    category: 'analytics',
    scope: 'both',
    test: /clarity\.ms/,
  },
  {
    id: 'plausible',
    name: 'Plausible',
    category: 'analytics',
    scope: 'both',
    test: /plausible\.io\/js|data-domain=/,
  },
  {
    id: 'vercel-analytics',
    name: 'Vercel Analytics',
    category: 'analytics',
    scope: 'both',
    test: /va\.vercel-scripts\.com|\/_vercel\/insights/,
  },
  // ---- infra (HTML内の痕跡) ----
  {
    id: 'cloudflare-html',
    name: 'Cloudflare',
    category: 'infra',
    scope: 'html',
    test: /\/cdn-cgi\//,
  },
]

/** レスポンスヘッダから配信インフラを特定する */
const HEADER_SIGNATURES: Array<{
  id: string
  name: string
  test: (headers: Record<string, string>) => boolean
}> = [
  {
    id: 'vercel',
    name: 'Vercel',
    test: (h) => 'x-vercel-id' in h || h['server'] === 'Vercel',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    test: (h) => 'x-nf-request-id' in h || /netlify/i.test(h['server'] ?? ''),
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    test: (h) => /cloudflare/i.test(h['server'] ?? '') || 'cf-ray' in h,
  },
  {
    id: 'cloudfront',
    name: 'Amazon CloudFront',
    test: (h) => 'x-amz-cf-id' in h || /cloudfront/i.test(h['via'] ?? ''),
  },
  {
    id: 'fastly',
    name: 'Fastly',
    test: (h) =>
      'x-fastly-request-id' in h ||
      (/varnish/i.test(h['via'] ?? '') && 'x-served-by' in h),
  },
  {
    id: 'github-pages',
    name: 'GitHub Pages',
    test: (h) => /github\.com/i.test(h['server'] ?? ''),
  },
  {
    id: 'nginx',
    name: 'nginx',
    test: (h) => /nginx/i.test(h['server'] ?? ''),
  },
]

export interface DetectInput {
  html: string
  headers: Record<string, string>
  /** 取得した各スクリプトの中身 (インライン含む) */
  scripts: Array<{ url: string; content: string }>
}

export function detect(input: DetectInput): Finding[] {
  const findings = new Map<string, Finding>()
  const superseded = new Set<string>()

  for (const sig of SIGNATURES) {
    const sources: Array<{ label: string; text: string }> = []
    if (sig.scope === 'html' || sig.scope === 'both') {
      sources.push({ label: 'HTML', text: input.html })
    }
    if (sig.scope === 'js' || sig.scope === 'both') {
      for (const s of input.scripts) {
        sources.push({ label: s.url, text: s.content })
      }
    }

    for (const src of sources) {
      const m = src.text.match(sig.test)
      if (!m) continue
      const ver = sig.version?.(src.text)
      const shortLabel =
        src.label === 'HTML'
          ? 'HTML'
          : src.label.replace(/^https?:\/\/[^/]+/, '').slice(0, 80) || src.label
      const existing = findings.get(sig.id)
      // 既に見つかっていてもバージョンが取れた方を優先する
      if (!existing || (ver && !existing.version)) {
        findings.set(sig.id, {
          id: sig.id,
          name: sig.name,
          category: sig.category,
          version: ver?.value,
          versionGuessed: ver?.guessed,
          quip: QUIPS[sig.id] ?? '',
          evidence: `${shortLabel} 内に \`${truncate(m[0], 48)}\` を検出`,
        })
        for (const weak of sig.supersedes ?? []) superseded.add(weak)
      }
      if (findings.get(sig.id)?.version) break
    }
  }

  for (const hs of HEADER_SIGNATURES) {
    if (hs.test(input.headers)) {
      findings.set(`hdr-${hs.id}`, {
        id: `hdr-${hs.id}`,
        name: hs.name,
        category: 'infra',
        quip: HEADER_QUIPS[hs.id] ?? '',
        evidence: 'レスポンスヘッダから検出',
      })
    }
  }

  // react19はreactの補足情報なので、両方出さずreactのquipを差し替える
  const react19 = findings.get('react19')
  const react = findings.get('react')
  if (react19 && react) {
    react.quip = react19.quip
    if (!react.version) {
      react.version = '19.x'
      react.versionGuessed = true
    }
    findings.delete('react19')
  }

  for (const id of superseded) findings.delete(id)

  const order: Category[] = [
    'bundler',
    'framework',
    'ui',
    'library',
    'analytics',
    'infra',
  ]
  return [...findings.values()].sort(
    (a, b) => order.indexOf(a.category) - order.indexOf(b.category),
  )
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
