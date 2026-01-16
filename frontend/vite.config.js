import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Alias for pdfjs-dist to ensure Vite resolves it correctly
      'pdfjs-dist': path.resolve(__dirname, 'node_modules/pdfjs-dist'),
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist'], // Pre-bundle pdfjs-dist to handle its dependencies
  },
  build: {
    rollupOptions: {
      // Ensure the worker script is treated as an asset
      output: {
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});