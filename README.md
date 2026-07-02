# すっぴんJS

URLを入力して診断すると、配信されている本番バンドルを回収して
[wakaru](https://github.com/pionxzh/wakaru) を使ってunminifyを行い、
サイトで使われている技術スタック (バンドラ・フレームワーク・ライブラリなど) を
知ることができるツールです。

## 使い方

```bash
npm install
npm run dev
```

`http://localhost:4321` を開いてURLを入れて「診断する」を押すだけ。

本番ビルド:

```bash
npm run build
npm run start   # node ./dist/server/entry.mjs
```

## 何をしているのか

1. 入力されたURLのHTMLを取得して `<script>` タグ (と `modulepreload`) を漁る
2. 外部スクリプトを回収 (最大10ファイル / 各8MBまで)
3. HTML・JS・レスポンスヘッダを**シグネチャ辞書**と突き合わせて、
   バンドラ / フレームワーク / UIライブラリ / 計測SDK / 配信インフラを特定
   - minify後も生き残る文字列 (`webpackChunk`, `Symbol.for("react.element")`,
     `__lodash_hash_undefined__` など) を狙い撃ち
   - react-domがDevTools hookに登録するバージョン文字列からReactのバージョンも抜く
4. 各バンドルを `@wakaru/unpacker` でモジュール単位に解体してモジュール数を計測
5. 一番モジュールが多かったバンドルの代表モジュールを `@wakaru/unminify` で
   読めるコードに復元してプレビュー表示

## 構成

```
src/
  pages/
    index.astro       # UI (入力・診断中表示・結果)
    api/analyze.ts    # POST /api/analyze
  lib/
    analyzer.ts       # 取得・wakaru実行のオーケストレーション
    detectors.ts      # シグネチャ辞書 (検出ロジック)
    messages.ts       # 画面・診断結果に表示する文言の定義
```

- フロントエンドは [Astro](https://astro.build) + `@astrojs/node` (standalone SSR)
- `/?u=<診断したいURL>` 形式で開くと自動で診断が走ります

## 環境変数

| 変数 | 説明 |
| --- | --- |
| `ALLOW_LOCAL=1` | localhost / プライベートIPへの診断を許可する (開発・テスト用。本番では設定しないこと) |
| `PORT` | 本番サーバーのポート (デフォルト 4321) |

## 注意

- 診断は取得できた範囲からの**推定**です。外れることもあります
- SSRF対策としてプライベートアドレスへのリクエストは既定で拒否します
- 相手サーバーに負荷をかけない範囲で、行儀よく使ってください

## メモ: wakaruの読み込みについて

`@wakaru/unminify` のESMビルドは `prettier/parser-babel` (prettier v2) の
サブパス解決に失敗するため、`astro.config.mjs` で `ssr.external` に指定した上で
`createRequire` 経由でCJSビルドを読み込んでいます (`src/lib/analyzer.ts`)。
