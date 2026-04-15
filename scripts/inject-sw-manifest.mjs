// scripts/inject-sw-manifest.mjs
// Reads Vite's asset manifest and injects hashed asset URLs into dist/sw.js
// so the service worker can precache them at install time for true offline support.
//
// Run automatically after `vite build` via the `build` npm script.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(__dirname, '..', 'dist')
const BASE = '/picocalc-emu/' // must match vite.config.ts base

// Read Vite's generated manifest (requires `build.manifest: true` in vite.config.ts)
const manifest = JSON.parse(readFileSync(resolve(DIST, '.vite/manifest.json'), 'utf8'))

// Collect every output file: JS entries + their CSS chunks
const urls = new Set()
for (const entry of Object.values(manifest)) {
  urls.add(BASE + entry.file)
  for (const css of entry.css ?? []) urls.add(BASE + css)
}

// Build the replacement line
const injection =
  'const VITE_ASSETS = [\n' +
  [...urls].map((u) => `  '${u}'`).join(',\n') +
  ',\n];'

// Patch dist/sw.js — replace the placeholder
const swPath = resolve(DIST, 'sw.js')
const original = readFileSync(swPath, 'utf8')
if (!original.includes('const VITE_ASSETS = [];')) {
  console.error('[inject-sw-manifest] Placeholder not found in dist/sw.js — skipping.')
  process.exit(1)
}
writeFileSync(swPath, original.replace('const VITE_ASSETS = [];', injection))
console.log(`[inject-sw-manifest] Injected ${urls.size} hashed asset(s) into dist/sw.js`)
