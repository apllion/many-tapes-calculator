import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(process.env.NO_SSL ? [] : [basicSsl()]),
  ],
  base: '/many-tapes-calculator/',
}))
