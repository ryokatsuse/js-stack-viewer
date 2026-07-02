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
  /**
   * 'js' = バンドル本体, 'html' = ドキュメント, 'both' = html+js,
   * 'css' = スタイルシート (インライン<style>を含むHTMLも見る)
   */
  scope: 'js' | 'html' | 'both' | 'css'
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
    id: 'bun',
    name: 'Bun (バンドラ)',
    category: 'bundler',
    scope: 'js',
    // bun buildが出力に付けるプラグマ (target: bunのビルドで付与される)
    test: /^\/\/\s*@bun(?:\s|@|$)/m,
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
    // astro-islandはhydrateするアイランドがないと出力されないため、
    // ビルド済みAstroサイトに常に現れる /_astro/ とgeneratorメタも見る
    test: /<astro-island|astro-static-slot|["'][^"']*\/_astro\/|content=["']Astro v[\d.]/,
    version: (src) => {
      const m = src.match(/content=["']Astro v([\d.]+)["']/)
      return m ? exact(m[1]!) : undefined
    },
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
  {
    id: 'alpine',
    name: 'Alpine.js',
    category: 'framework',
    scope: 'both',
    test: /\bx-data=|alpinejs|Alpine\.start/,
  },
  {
    id: 'htmx',
    name: 'htmx',
    category: 'framework',
    scope: 'both',
    test: /htmx\.org|\bhx-(?:get|post|swap|trigger|target)=/,
  },
  // ---- framework (UIフレームワーク / ランタイム) ----
  {
    id: 'react',
    name: 'React',
    category: 'framework',
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
      // 正確なバージョンが取れないときは、各世代で追加されたAPIの痕跡
      // (minify後も残るexportsのプロパティ名やSymbol名) から世代を推定する
      if (/["']react\.transitional\.element["']/.test(src)) return guessed('19.x')
      if (/\.useInsertionEffect\s*=|["']useInsertionEffect["']/.test(src))
        return guessed('18.x')
      if (/\.useState\s*=|["']useState["']/.test(src))
        return guessed('16.8〜17.x')
      if (/["']react\.element["']/.test(src)) return guessed('16〜17.x')
      return undefined
    },
  },
  {
    id: 'react19',
    name: 'React 19系',
    category: 'framework',
    scope: 'js',
    test: /["']react\.transitional\.element["']/,
  },
  {
    id: 'vue',
    name: 'Vue',
    category: 'framework',
    scope: 'js',
    test: /__v_isRef|__v_skip|_isVue\b/,
  },
  {
    id: 'preact',
    name: 'Preact',
    category: 'framework',
    scope: 'js',
    test: /__PREACT_DEVTOOLS__|preact\/compat/,
  },
  {
    id: 'svelte',
    name: 'Svelte',
    category: 'framework',
    scope: 'both',
    test: /\.svelte-[a-z0-9]+/,
  },
  {
    id: 'jquery',
    name: 'jQuery',
    category: 'framework',
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
  // ---- UI library (コンポーネント / スタイル) ----
  {
    id: 'mui',
    name: 'MUI (Material UI)',
    category: 'ui',
    scope: 'both',
    test: /Mui[A-Z][a-zA-Z]+-root|--mui-palette|\bMui-(?:focused|selected|disabled)\b/,
  },
  {
    id: 'bootstrap',
    name: 'Bootstrap',
    category: 'ui',
    scope: 'css',
    test: /\bdata-bs-[a-z-]+=|Bootstrap\s+v\d/,
    version: (src) => {
      // ビルド後も残るライセンスバナー /*! Bootstrap v5.3.3 ... */
      const m = src.match(/Bootstrap\s+v([\d.]+)/)
      return m ? exact(m[1]!) : undefined
    },
  },
  {
    id: 'react-aria',
    name: 'React Aria',
    category: 'ui',
    scope: 'both',
    // useIdが生成する react-aria- プレフィックスのidと、
    // react-aria-componentsが付与する data-rac 属性
    test: /react-aria-[:\dR«]|\bdata-rac\b/,
  },
  {
    id: 'radix',
    name: 'Radix UI',
    category: 'ui',
    scope: 'both',
    test: /data-radix-|\bradix-[:«]/,
  },
  {
    id: 'chakra',
    name: 'Chakra UI',
    category: 'ui',
    scope: 'both',
    test: /--chakra-|\bchakra-(?:button|stack|text|heading|modal|input)\b/,
  },
  {
    id: 'antd',
    name: 'Ant Design',
    category: 'ui',
    scope: 'both',
    test: /\bant-(?:btn|input|select|modal|form|layout|menu|table)\b|--ant-/,
  },
  {
    id: 'mantine',
    name: 'Mantine',
    category: 'ui',
    scope: 'both',
    test: /--mantine-|data-mantine-/,
  },
  {
    id: 'headlessui',
    name: 'Headless UI',
    category: 'ui',
    scope: 'both',
    test: /data-headlessui-|\bheadlessui-/,
  },
  {
    id: 'fontawesome',
    name: 'Font Awesome',
    category: 'ui',
    scope: 'both',
    test: /font-?awesome/i,
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
    scope: 'css',
    test: /--tw-[a-z-]+|tailwindcss v\d/,
    version: (src) => {
      // ビルド後も残るライセンスバナー /*! tailwindcss v4.1.5 | MIT License */
      const m = src.match(/tailwindcss v([\d.]+)/)
      return m ? exact(m[1]!) : undefined
    },
  },
  {
    id: 'redux',
    name: 'Redux',
    category: 'library',
    scope: 'js',
    // 内部アクションタイプ "@@redux/INIT..." はminify後も残る
    test: /@@redux\//,
  },
  {
    id: 'zod',
    name: 'Zod',
    category: 'library',
    scope: 'js',
    // ZodIssueCodeの文字列リテラルはminify後も残る
    test: /unrecognized_keys|invalid_union_discriminator/,
  },
  {
    id: 'threejs',
    name: 'Three.js',
    category: 'library',
    scope: 'js',
    // 警告メッセージの "THREE.〜" プレフィックスはminify後も残る
    test: /THREE\.WebGLRenderer|THREE\.REVISION/,
  },
  {
    id: 'chartjs',
    name: 'Chart.js',
    category: 'library',
    scope: 'both',
    test: /Chart\.js v[\d.]+|cdn\.jsdelivr\.net\/npm\/chart\.js/,
    version: (src) => {
      // ライセンスバナー /*! Chart.js v4.4.1 ... */
      const m = src.match(/Chart\.js v([\d.]+)/)
      return m ? exact(m[1]!) : undefined
    },
  },
  {
    id: 'd3',
    name: 'D3.js',
    category: 'library',
    scope: 'both',
    // 配布物の先頭バナー "// https://d3js.org v7.x.x"
    test: /d3js\.org/,
    version: (src) => {
      const m = src.match(/d3js\.org v([\d.]+)/)
      return m ? exact(m[1]!) : undefined
    },
  },
  {
    id: 'gsap',
    name: 'GSAP',
    category: 'library',
    scope: 'both',
    test: /\bgsap\b/i,
  },
  {
    id: 'swiper',
    name: 'Swiper',
    category: 'library',
    scope: 'both',
    test: /swiper-(?:wrapper|slide|container)/,
  },
  {
    id: 'stripe',
    name: 'Stripe.js',
    category: 'library',
    scope: 'both',
    test: /js\.stripe\.com/,
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
    id: 'bun',
    name: 'Bun',
    test: (h) => /\bbun\b/i.test(h['server'] ?? '') || 'x-bun-version' in h,
  },
  {
    id: 'deno',
    name: 'Deno',
    // Deno Deployは server: deno/gcp-asia-northeast1 のようなヘッダを返す
    test: (h) => /\bdeno\b/i.test(h['server'] ?? '') || 'x-deno-ray' in h,
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
  /** 取得した外部スタイルシートの中身 */
  styles?: Array<{ url: string; content: string }>
}

export function detect(input: DetectInput): Finding[] {
  const findings = new Map<string, Finding>()
  const superseded = new Set<string>()

  for (const sig of SIGNATURES) {
    const sources: Array<{ label: string; text: string }> = []
    if (sig.scope === 'html' || sig.scope === 'both' || sig.scope === 'css') {
      sources.push({ label: 'HTML', text: input.html })
    }
    if (sig.scope === 'js' || sig.scope === 'both') {
      for (const s of input.scripts) {
        sources.push({ label: s.url, text: s.content })
      }
    }
    if (sig.scope === 'css') {
      for (const s of input.styles ?? []) {
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
      // (推定値しかない場合は正確な値で上書きする)
      if (
        !existing ||
        (ver && (!existing.version || (existing.versionGuessed && !ver.guessed)))
      ) {
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
      // 正確なバージョンが取れたら残りのソースは見なくてよい
      // (推定値のうちはより正確な値を求めて探索を続ける)
      const found = findings.get(sig.id)
      if (found?.version && !found.versionGuessed) break
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
