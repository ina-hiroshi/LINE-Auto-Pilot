import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { sitePagesPlugin } from './build/sitePages'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), sitePagesPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
