import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  esbuild: {
    drop: mode === 'production' ? ['debugger'] : [],
    // Narrowly eliminate development diagnostic console outputs in production while preserving console.error and console.warn
    pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
  },
}));
