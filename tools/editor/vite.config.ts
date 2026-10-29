import path from 'node:path';
import { defineConfig } from 'vite';
import { postsApi } from './api.ts';

// Local-only editor for src/content/blog. Run with `npm run write`.
export default defineConfig({
   root: import.meta.dirname,
   // Keep apart from Astro's own Vite cache, since both servers run at once.
   cacheDir: path.resolve(import.meta.dirname, '../../node_modules/.vite-editor'),
   server: { port: 4322, strictPort: true },
   optimizeDeps: { include: ['@milkdown/crepe', '@milkdown/kit/component/image-block', '@milkdown/kit/preset/commonmark'] },
   // Crepe bundles Vue for some of its widgets.
   define: { __VUE_OPTIONS_API__: false, __VUE_PROD_DEVTOOLS__: false, __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false },
   plugins: [postsApi()],
});
