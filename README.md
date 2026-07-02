# 技術スタックビューワー

URLを入力して診断すると、配信されている本番バンドルを回収して
[wakaru](https://github.com/pionxzh/wakaru) を使ってunminifyを行い、
サイトで使われている技術スタック (バンドラ・フレームワーク・ライブラリなど) を
知ることができるツールです。

## 使い方

```bash
pnpm install
pnpm dev
```

`http://localhost:4321` を開いてURLを入れて「診断する」を押すだけ。

本番ビルド:

```bash
pnpm build   # Vercel向けの出力 (.vercel/output) を生成
```

デプロイはVercelで行う (`@astrojs/vercel` アダプタを使用)。

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


## 環境変数

| 変数 | 説明 |
| --- | --- |
| `ALLOW_LOCAL=1` | localhost / プライベートIPへの診断を許可する (開発・テスト用。本番では設定しないこと) |
| `PORT` | 本番サーバーのポート (デフォルト 4321) |

## 注意

- 診断は取得できた範囲からの**推定**です。外れることもあります
- 相手サーバーに負荷をかけない範囲で、行儀よく使ってください
