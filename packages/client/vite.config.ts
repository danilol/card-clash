import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Same origin in dev as in production (story 4.2, D26): the browser
    // talks only to 5173, and Vite forwards API + socket traffic to the
    // server. So the client uses relative URLs and needs no CORS.
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  // globals: true lets Testing Library auto-clean the DOM between tests
  test: { environment: 'jsdom', globals: true },
});
