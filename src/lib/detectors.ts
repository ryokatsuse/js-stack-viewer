/**
 * 本番バンドル / HTML / レスポンスヘッダから技術スタックの痕跡を探す
 * シグネチャ辞書。minify後も生き残る文字列リテラルやグローバル名を狙う。
 */

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
  /** 「これwebpack 5製だな」のような一言 */
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
  quip: string
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
    quip: 'これwebpack 5製だな。チャンク配列 webpackChunk が生えてる。',
    supersedes: ['webpack'],
  },
  {
    id: 'webpack4',
    name: 'webpack 4',
    category: 'bundler',
    scope: 'js',
    test: /webpackJsonp/,
    quip: 'webpackJsonp がいる。webpack 4、ちょっと年季が入ってる。',
    supersedes: ['webpack'],
  },
  {
    id: 'webpack',
    name: 'webpack',
    category: 'bundler',
    scope: 'js',
    test: /__webpack_require__|__webpack_exports__/,
    quip: '__webpack_require__ の匂いがする。webpack製なのは間違いない。',
  },
  {
    id: 'vite',
    name: 'Vite (Rollup)',
    category: 'bundler',
    scope: 'both',
    test: /__vitePreload|__vite__mapDeps|__vite_legacy_guard/,
    quip: 'Vite製。プリロードヘルパーが仕込まれてる、今どきのビルドだ。',
  },
  {
    id: 'parcel',
    name: 'Parcel',
    category: 'bundler',
    scope: 'js',
    test: /parcelRequire/,
    quip: 'parcelRequire 発見。Parcelでゼロコンフィグしてるな。',
  },
  {
    id: 'esbuild',
    name: 'esbuild',
    category: 'bundler',
    scope: 'js',
    test: /var __toESM\s*=|var __toCommonJS\s*=|__esbuild/,
    quip: 'esbuildのinteropヘルパーが残ってる。ビルドは爆速なやつ。',
  },
  // ---- framework (メタフレームワーク / CMS) ----
  {
    id: 'nextjs',
    name: 'Next.js',
    category: 'framework',
    scope: 'both',
    test: /__NEXT_DATA__|\/_next\/static\/|__next_f/,
    quip: 'Next.js製。/_next/ 配下からチャンクが降ってきてる。',
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    category: 'framework',
    scope: 'both',
    test: /window\.__NUXT__|\/_nuxt\//,
    quip: '__NUXT__ が窓に生えてる。Nuxt製だ。',
  },
  {
    id: 'gatsby',
    name: 'Gatsby',
    category: 'framework',
    scope: 'both',
    test: /___gatsby|___chunkMapping/,
    quip: '___gatsby を発見。静的サイトに見えてReactがフル稼働してる。',
  },
  {
    id: 'remix',
    name: 'Remix / React Router',
    category: 'framework',
    scope: 'both',
    test: /__remixContext|__reactRouterContext/,
    quip: '__remixContext が埋まってる。Remix系のフルスタック構成。',
  },
  {
    id: 'sveltekit',
    name: 'SvelteKit',
    category: 'framework',
    scope: 'both',
    test: /__sveltekit_/,
    quip: '__sveltekit_ の刻印あり。SvelteKit製。',
  },
  {
    id: 'astro',
    name: 'Astro',
    category: 'framework',
    scope: 'html',
    test: /<astro-island|astro-static-slot/,
    quip: 'astro-island が浮いてる。Astroのアイランドアーキテクチャだ。',
  },
  {
    id: 'angular',
    name: 'Angular',
    category: 'framework',
    scope: 'html',
    test: /ng-version="[\d.]+"/,
    quip: 'ng-version属性が正直に名乗ってる。Angular製。',
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
    quip: 'wp-content が見えてる。実はWordPressで動いてる。',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'framework',
    scope: 'both',
    test: /cdn\.shopify\.com|Shopify\.theme/,
    quip: 'Shopifyのテーマが動いてる。ECの裏側はお任せ構成。',
  },
  // ---- UI library ----
  {
    id: 'react',
    name: 'React',
    category: 'ui',
    scope: 'js',
    test: /["']react\.element["']|["']react\.transitional\.element["']|__REACT_DEVTOOLS_GLOBAL_HOOK__/,
    quip: 'Reactのfiber実装が回ってる。Symbol("react.element")は隠せない。',
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
    quip: 'react.transitional.element … これはReact 19系のfiberだ。',
    supersedes: [],
  },
  {
    id: 'vue',
    name: 'Vue',
    category: 'ui',
    scope: 'js',
    test: /__v_isRef|__v_skip|_isVue\b/,
    quip: 'リアクティビティの内部フラグ __v_isRef が残ってる。Vueだ。',
  },
  {
    id: 'preact',
    name: 'Preact',
    category: 'ui',
    scope: 'js',
    test: /__PREACT_DEVTOOLS__|preact\/compat/,
    quip: 'Preactで軽量に済ませてる。3KBの賢い選択。',
  },
  {
    id: 'svelte',
    name: 'Svelte',
    category: 'ui',
    scope: 'both',
    test: /\.svelte-[a-z0-9]+/,
    quip: 'svelte- のスコープ付きclassが散らばってる。Svelteがコンパイル済み。',
  },
  {
    id: 'jquery',
    name: 'jQuery',
    category: 'ui',
    scope: 'js',
    test: /jQuery v\d|fn\.jquery\s*=|jquery\.org\/license/i,
    quip: 'jQueryがまだ現役で頑張ってる。',
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
    quip: 'Lodash同梱。ユーティリティは手堅く外注派。',
  },
  {
    id: 'moment',
    name: 'Moment.js',
    category: 'library',
    scope: 'js',
    test: /_isAMomentObject/,
    quip: 'Moment.jsがバンドルに鎮座してる。日付処理が重厚。',
  },
  {
    id: 'dayjs',
    name: 'Day.js',
    category: 'library',
    scope: 'js',
    test: /\$isDayjsObject/,
    quip: 'Day.jsで日付処理を軽量化してる。',
  },
  {
    id: 'axios',
    name: 'Axios',
    category: 'library',
    scope: 'js',
    test: /isAxiosError/,
    quip: 'HTTPはAxios経由。isAxiosErrorが目印。',
  },
  {
    id: 'corejs',
    name: 'core-js',
    category: 'library',
    scope: 'js',
    test: /__core-js_shared__|core-js\//,
    quip: 'core-jsのpolyfillを抱えてる。古いブラウザもまだ見捨ててない。',
  },
  {
    id: 'styled-components',
    name: 'styled-components',
    category: 'library',
    scope: 'both',
    test: /styled-components|sc-component-id/,
    quip: 'CSS-in-JSはstyled-components派。',
  },
  {
    id: 'emotion',
    name: 'Emotion',
    category: 'library',
    scope: 'both',
    test: /data-emotion|@emotion\//,
    quip: 'EmotionでCSS-in-JSしてる。',
  },
  {
    id: 'tailwind',
    name: 'Tailwind CSS',
    category: 'library',
    scope: 'both',
    test: /--tw-[a-z-]+/,
    quip: '--tw- カスタムプロパティが出てる。Tailwind製の見た目。',
  },
  {
    id: 'zonejs',
    name: 'zone.js',
    category: 'library',
    scope: 'js',
    test: /__zone_symbol__|Zone\.__load_patch/,
    quip: 'zone.jsが非同期処理を全部フックしてる。Angularの相棒。',
  },
  {
    id: 'graphql',
    name: 'GraphQLクライアント',
    category: 'library',
    scope: 'js',
    test: /__typename/,
    quip: '__typename が見える。データ取得はGraphQL。',
  },
  {
    id: 'socketio',
    name: 'Socket.IO',
    category: 'library',
    scope: 'js',
    test: /engine\.io|socket\.io/,
    quip: 'Socket.IOでリアルタイム通信してる。裏で常時接続。',
  },
  {
    id: 'firebase',
    name: 'Firebase',
    category: 'library',
    scope: 'js',
    test: /@firebase\/|firebaseio\.com|firebaseapp\.com/,
    quip: 'Firebase SDKが入ってる。バックエンドはGoogleにお任せ。',
  },
  // ---- analytics / monitoring ----
  {
    id: 'ga',
    name: 'Google Analytics (gtag)',
    category: 'analytics',
    scope: 'both',
    test: /googletagmanager\.com\/gtag|[^\w]gtag\(/,
    quip: 'gtagが発火してる。あなたの行動、Googleに送信中。',
  },
  {
    id: 'gtm',
    name: 'Google Tag Manager',
    category: 'analytics',
    scope: 'both',
    test: /googletagmanager\.com\/gtm\.js|["']GTM-[A-Z0-9]{4,}["']/,
    quip: 'GTMコンテナ搭載。タグは動的に何でも差し込める状態。',
  },
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'analytics',
    scope: 'js',
    test: /__SENTRY__|ingest\.sentry\.io|sentry\.io\/api/,
    quip: 'Sentry仕込み済み。エラーは全部監視されてる。',
  },
  {
    id: 'datadog',
    name: 'Datadog RUM',
    category: 'analytics',
    scope: 'js',
    test: /datadoghq|DD_RUM/,
    quip: 'DatadogのRUMが動いてる。パフォーマンスも行動も計測中。',
  },
  {
    id: 'newrelic',
    name: 'New Relic',
    category: 'analytics',
    scope: 'js',
    test: /NREUM|newrelic\.com/,
    quip: 'New Relicのエージェントが常駐してる。',
  },
  {
    id: 'hotjar',
    name: 'Hotjar',
    category: 'analytics',
    scope: 'both',
    test: /hotjar/i,
    quip: 'Hotjar搭載。あなたのマウスの動き、録画されてるかも。',
  },
  {
    id: 'clarity',
    name: 'Microsoft Clarity',
    category: 'analytics',
    scope: 'both',
    test: /clarity\.ms/,
    quip: 'Clarityでセッション録画中。Microsoftも見てる。',
  },
  {
    id: 'plausible',
    name: 'Plausible',
    category: 'analytics',
    scope: 'both',
    test: /plausible\.io\/js|data-domain=/,
    quip: '計測はPlausible。プライバシーには気を使ってるタイプ。',
  },
  {
    id: 'vercel-analytics',
    name: 'Vercel Analytics',
    category: 'analytics',
    scope: 'both',
    test: /va\.vercel-scripts\.com|\/_vercel\/insights/,
    quip: 'Vercel Analyticsで計測してる。',
  },
  // ---- infra (HTML内の痕跡) ----
  {
    id: 'cloudflare-html',
    name: 'Cloudflare',
    category: 'infra',
    scope: 'html',
    test: /\/cdn-cgi\//,
    quip: '/cdn-cgi/ が見える。Cloudflare経由で配信されてる。',
  },
]

/** レスポンスヘッダから配信インフラを特定する */
const HEADER_SIGNATURES: Array<{
  id: string
  name: string
  quip: string
  test: (headers: Record<string, string>) => boolean
}> = [
  {
    id: 'vercel',
    name: 'Vercel',
    quip: 'x-vercel-id が返ってきた。ホスティングはVercel。',
    test: (h) => 'x-vercel-id' in h || h['server'] === 'Vercel',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    quip: 'Netlifyから配信されてる。',
    test: (h) => 'x-nf-request-id' in h || /netlify/i.test(h['server'] ?? ''),
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    quip: 'server: cloudflare。エッジはCloudflareが握ってる。',
    test: (h) => /cloudflare/i.test(h['server'] ?? '') || 'cf-ray' in h,
  },
  {
    id: 'cloudfront',
    name: 'Amazon CloudFront',
    quip: 'CloudFrontのCDN経由。AWSの上で動いてる。',
    test: (h) => 'x-amz-cf-id' in h || /cloudfront/i.test(h['via'] ?? ''),
  },
  {
    id: 'fastly',
    name: 'Fastly',
    quip: 'Fastly (Varnish) がキャッシュしてる。',
    test: (h) =>
      'x-fastly-request-id' in h ||
      (/varnish/i.test(h['via'] ?? '') && 'x-served-by' in h),
  },
  {
    id: 'github-pages',
    name: 'GitHub Pages',
    quip: 'server: GitHub.com。GitHub Pagesで無料ホスティング。',
    test: (h) => /github\.com/i.test(h['server'] ?? ''),
  },
  {
    id: 'nginx',
    name: 'nginx',
    quip: 'nginxが直接顔を出してる。',
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
          quip: sig.quip,
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
        quip: hs.quip,
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
