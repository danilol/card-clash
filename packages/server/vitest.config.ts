import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // server tests run in Node, no browser
  },
});
