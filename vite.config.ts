import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // This repository is published as a GitHub Pages project site.
  base: '/FM/',
  plugins: [react()],
})
