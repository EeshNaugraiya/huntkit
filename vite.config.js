import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: './manifest.json',
      additionalInputs: [
        'src/popup/index.html',
        'src/sidebar/index.html',
        'src/resume/index.html',
        'src/content/linkedin.js',
        'src/content/naukri.js',
        'src/content/indeed.js',
        'src/content/generic.js',
      ],
    }),
  ],
  build: {
    minify: false,
    sourcemap: true,
  },
});