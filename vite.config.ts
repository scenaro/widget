import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copy } from 'vite-plugin-copy'; // We might need a plugin if lib mode is strict, or just a custom rollup plugin.
// Actually, standard Vite copyPublicDir should work unless lib mode disables it.
// Let's try a manual copy plugin approach if needed, or just a post-build script.
// Simplest fix for now: use a shell command in package.json or a simple rollup plugin.

// Better: let's just use a simple rollup plugin to copy the runtime.
import fs from 'fs';
import path from 'path';

function copyRuntime() {
  return {
    name: 'copy-runtime',
    closeBundle: async () => {
      const src = resolve(__dirname, 'public/runtime');
      const dest = resolve(__dirname, 'dist/runtime');
      
      // Recursive copy function or simple fs.cp (Node 16+)
      if (fs.existsSync(src)) {
        fs.mkdirSync(dest, { recursive: true });
        fs.cpSync(src, dest, { recursive: true });
        console.log('[copy-runtime] Copied public/runtime to dist/runtime');
      }
    }
  }
}

export default defineConfig({
  publicDir: false, // Disable default copy to avoid conflicts if any, or keep it. 
  // Lib mode often ignores publicDir for index.html but should copy assets. 
  // However, let's force it with our plugin to be sure.
  
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: {
        widget: resolve(__dirname, 'src/widget.ts'),
        'engines/commerce': resolve(__dirname, 'src/engines/commerce/index.ts'),
        'connectors/magento': resolve(__dirname, 'src/connectors/magento/index.ts')
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'js' : 'cjs';
        return `${entryName}.${ext}`;
      }
    }
    },
  plugins: [copyRuntime()]
});
