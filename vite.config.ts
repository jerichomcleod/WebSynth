import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: process.env.GITHUB_ACTIONS ? '/WebSynth/' : '/',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
})
