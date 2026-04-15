import { defineConfig } from 'vite'

// Change this to match your GitHub Pages repo name.
// e.g. if hosted at https://user.github.io/picocalc-emu/ → '/picocalc-emu/'
// For a user/org page at the root → '/'
const BASE = '/picocalc-emu/'

export default defineConfig({
  base: BASE,
  build: {
    // Emit .vite/manifest.json so inject-sw-manifest.mjs can read hashed filenames
    manifest: true,
  },
})
