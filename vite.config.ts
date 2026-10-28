/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// `base: './'` keeps asset URLs relative so the build works on GitHub Pages
// project sites (https://<user>.github.io/<repo>/) and any other static host.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // a single ~180 kB (gzip) bundle; splitting it would only add round trips
    chunkSizeWarningLimit: 800,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
})
