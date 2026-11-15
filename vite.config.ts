import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE lets the same build run at a sub-path, e.g. GitHub Pages: BASE=/roman-os/ npm run build
export default defineConfig({
  base: process.env.BASE ?? '/',
  plugins: [react()],
  build: { target: 'es2020' },
})
