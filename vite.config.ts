/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    // Moduł ustawień operuje na elemencie html, więc testy potrzebują DOM.
    environment: 'jsdom',
  },
});
