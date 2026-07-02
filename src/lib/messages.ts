/**
 * 画面や診断結果に表示する文言の定義。
 * 表現を調整したいときはこのファイルだけ編集すればよい。
 */

/** 検出したシグネチャ (detectors.tsのSIGNATURES) ごとの説明文 */
export const QUIPS: Record<string, string> = {
  // バンドラ
  webpack5: 'webpackChunk が見つかりました。webpack 5でビルドされています。',
  webpack4: 'webpackJsonp が見つかりました。webpack 4でビルドされています。',
  webpack: '__webpack_require__ が見つかりました。webpack製のバンドルです。',
  vite: 'Viteのプリロードヘルパーが見つかりました。Vite (Rollup) でビルドされています。',
  parcel: 'parcelRequire が見つかりました。Parcelでビルドされています。',
  esbuild: 'esbuildのヘルパー関数が見つかりました。esbuildでビルドされています。',
  // フレームワーク
  nextjs: '/_next/ 配下のチャンク構成が見つかりました。Next.js製です。',
  nuxt: '__NUXT__ が見つかりました。Nuxt製です。',
  gatsby: '___gatsby が見つかりました。Gatsby製です。',
  remix: '__remixContext が見つかりました。Remix系のフレームワークです。',
  sveltekit: '__sveltekit_ が見つかりました。SvelteKit製です。',
  astro: 'Astroの痕跡 (astro-island や /_astro/ のアセット) が見つかりました。Astro製です。',
  angular: 'ng-version属性が見つかりました。Angular製です。',
  wordpress: 'wp-content が見つかりました。WordPressで動いています。',
  shopify: 'Shopifyのテーマで動いています。',
  // UIライブラリ
  react: 'Reactの実行時マーカーが見つかりました。Reactが動いています。',
  react19: 'react.transitional.element が見つかりました。React 19系が動いています。',
  vue: 'リアクティビティの内部フラグが見つかりました。Vueが動いています。',
  preact: 'Preactが使われています。軽量なReact互換ライブラリです。',
  svelte: 'Svelteのスコープ付きclassが見つかりました。Svelteでコンパイルされています。',
  jquery: 'jQueryが使われています。',
  // ライブラリ
  lodash: 'Lodashがバンドルに含まれています。',
  moment: 'Moment.jsが含まれています。',
  dayjs: 'Day.jsで日付を処理しています。',
  axios: 'HTTP通信にAxiosを使っています。',
  corejs: 'core-jsのpolyfillが含まれています。幅広いブラウザに対応する構成です。',
  'styled-components': 'CSS-in-JSにstyled-componentsを使っています。',
  emotion: 'CSS-in-JSにEmotionを使っています。',
  tailwind: 'Tailwind CSSでスタイリングされています。',
  zonejs: 'zone.jsが使われています。Angularとよく組み合わせられるライブラリです。',
  graphql: '__typename が見つかりました。データ取得にGraphQLを使っています。',
  socketio: 'Socket.IOでリアルタイム通信をしています。',
  firebase: 'Firebase SDKが使われています。',
  // 計測・監視
  ga: 'Google Analytics (gtag) でアクセス解析をしています。',
  gtm: 'Google Tag Managerが設置されています。',
  sentry: 'Sentryでエラー監視をしています。',
  datadog: 'Datadog RUMでパフォーマンスを計測しています。',
  newrelic: 'New Relicで監視しています。',
  hotjar: 'Hotjarでユーザー行動を分析しています。',
  clarity: 'Microsoft Clarityで行動分析をしています。',
  plausible: 'Plausibleでアクセス解析をしています。',
  'vercel-analytics': 'Vercel Analyticsで計測しています。',
  // 配信インフラ (HTML内の痕跡)
  'cloudflare-html': '/cdn-cgi/ が見つかりました。Cloudflare経由で配信されています。',
}

/** レスポンスヘッダから検出した配信インフラ (detectors.tsのHEADER_SIGNATURES) の説明文 */
export const HEADER_QUIPS: Record<string, string> = {
  vercel: 'Vercelでホスティングされています。',
  netlify: 'Netlifyから配信されています。',
  cloudflare: 'Cloudflareのエッジから配信されています。',
  cloudfront: 'Amazon CloudFront経由で配信されています。',
  fastly: 'Fastlyがキャッシュ配信しています。',
  'github-pages': 'GitHub Pagesでホスティングされています。',
  nginx: 'nginxで配信されています。',
}

/** 画面表示用の文言 */
export const UI_TEXT = {
  loadingMessages: [
    'HTMLを取得中…',
    'スクリプトタグを調べています…',
    'バンドルを取得中…',
    'wakaruで解析しています…',
    'モジュールをunminify中…',
    '技術スタックを判定しています…',
  ],
  categoryLabels: {
    bundler: 'バンドラ',
    framework: 'フレームワーク',
    ui: 'UIライブラリ',
    library: 'ライブラリ',
    analytics: '計測・監視',
    infra: '配信インフラ',
  } as Record<string, string>,
  noFindings: '既知のシグネチャには該当しませんでした。',
  communicationError: 'サーバーとの通信に失敗しました',
  jsTotal: (files: number, size: string) =>
    `計 ${files} ファイル / ${size} のJavaScriptを取得`,
  moduleNone: '分割なし',
  moduleCount: (n: number) => `${n} modules`,
  version: (v: string, isGuessed: boolean) => (isGuessed ? `v${v} (推定)` : `v${v}`),
  previewMeta: (url: string, moduleId: string | number, truncated: boolean) =>
    `${url} の module ${moduleId}${truncated ? ' (長いので先頭のみ表示)' : ''}`,
} as const
