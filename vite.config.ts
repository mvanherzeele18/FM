import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  // Gebruik /FM/ bij production builds voor GitHub Pages, en / lokaal.
  base: command === 'build' ? '/FM/' : '/',
  plugins: [react()],
}))
