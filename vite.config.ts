import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'

// Served from https://fahyad.github.io/pay-forecast/ on GitHub Pages.
export default defineConfig({
  base: '/pay-forecast/',
  plugins: [preact()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
