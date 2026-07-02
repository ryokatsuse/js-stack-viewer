// @ts-check
import { defineConfig } from 'astro/config'
import node from '@astrojs/node'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  vite: {
    ssr: {
      // wakaruのESMビルドはprettier v2のサブパス解決が壊れているため、
      // バンドルせずcreateRequire経由のCJSビルドで読み込む
      external: ['@wakaru/unpacker', '@wakaru/unminify'],
    },
  },
})
