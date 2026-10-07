import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Cognito only accepts sign-in redirects back to http://localhost:5173, so
  // always use that port. If it's taken, fail loudly instead of quietly
  // switching to 5174 (which breaks sign-in with "redirect_mismatch").
  server: { port: 5173, strictPort: true },
})
