import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the build works from any subfolder (e.g. games.alchemix.uk/lattice-lock/)
  base: './',
  plugins: [react()],
  server: {
    // Scoreboard API during development: run `npm run dev:server` alongside `npm run dev`
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
