// @ts-check
import { defineConfig } from 'astro/config'
import vercel from '@astrojs/vercel'

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  vite: {
    ssr: {
      // wakaruのESMビルドはprettier v2のサブパス解決が壊れているため、
      // バンドルせずcreateRequire経由のCJSビルドで読み込む
      external: ['@wakaru/unpacker', '@wakaru/unminify'],
    },
  },
})
