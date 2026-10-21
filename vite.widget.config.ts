import { resolve } from 'path';
import { defineConfig } from 'vite';
import { soraFontDefine } from './scripts/sora-font.mjs';

// The storefront embed is a classic <script>, not type="module".
// A shared chunk would leave a static import in widget.js, which the browser rejects.
export default defineConfig({
  define: soraFontDefine(),
  server: {
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/widget.ts'),
      name: 'ScenaroWidget',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
