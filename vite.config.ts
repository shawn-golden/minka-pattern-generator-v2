import { defineConfig } from 'vite';

export default defineConfig({
  // No React, just vanilla TypeScript
  server: {
    port: 5173,
    strictPort: true,
  },
});

