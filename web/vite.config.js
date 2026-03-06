import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/meta': 'http://localhost:8000',
      '/bins': 'http://localhost:8000',
      '/upload': 'http://localhost:8000',
      '/mapping': 'http://localhost:8000',
    },
  },
});
