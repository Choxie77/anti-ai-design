// Reference output for agent/human review — not executed by tests.
// After the append-arrays CSP patch is applied, svelte.config.js should look
// like this.

import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Dev-only allowance so anti-ai-design live mode can load. Empty array in any
// non-development environment.
const __antiAiDesignLiveDev =
  process.env.NODE_ENV === 'development' ? ['http://localhost:8400'] : [];

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self', 'unsafe-inline', ...__antiAiDesignLiveDev],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'blob:'],
        'connect-src': ['self', ...__antiAiDesignLiveDev],
        'frame-ancestors': ['self'],
      },
    },
  },
};

export default config;
