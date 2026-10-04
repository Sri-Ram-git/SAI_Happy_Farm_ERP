import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    const env = loadEnv(mode, process.cwd(), '');
    const apiUrl = env.VITE_API_URL || env.VITE_API_BASE_URL;
    
    if (apiUrl && apiUrl.trim() !== '') {
      try {
        const url = new URL(apiUrl);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          console.warn('\n\n[BUILD WARNING] VITE_API_URL cannot be localhost in production!\n\n');
        }
      } catch (e: any) {
        console.warn(`\n\n[BUILD WARNING] VITE_API_URL is not a valid URL: ${apiUrl}\n\n`);
      }
    }
  }

  return {
    esbuild: {
      drop: mode === 'production' ? ['debugger'] : [],
      // Narrowly eliminate development diagnostic console outputs in production while preserving console.error and console.warn
      pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
    },
  };
});
