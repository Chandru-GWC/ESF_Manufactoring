import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev/preview servers proxy `/api` to the FastAPI backend so the browser stays
// same-origin (no CORS dependency). Override with VITE_PROXY_TARGET in .env.local.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000';
  const apiProxy = {
    '/api': {
      target: proxyTarget,
      changeOrigin: true,
    },
  };

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      open: false,
      proxy: apiProxy,
    },
    preview: {
      port: 4173,
      proxy: apiProxy,
    },
    // Pre-bundle every runtime dependency up front. Without this Vite discovers
    // react-router-dom / three / motion lazily, re-optimizes mid-session and serves
    // 504 "Outdated Optimize Dep" errors that leave the page blank.
    // Note: `motion/react` pulls in `framer-motion` as its own nested dependency;
    // the app never imports framer-motion directly.
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-router-dom',
        'motion/react',
        'framer-motion',
        'lucide-react',
        'clsx',
        'tailwind-merge',
        'three',
        'three/addons/controls/OrbitControls.js',
      ],
    },
  };
});
