import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  // globals: true lets Testing Library auto-clean the DOM between tests
  test: { environment: 'jsdom', globals: true },
});
