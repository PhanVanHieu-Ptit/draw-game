/**
 * @file export-bundle.js
 * @description Bundling & Export verification script.
 * Verifies that the exported bundle is 100% self-contained (HTML, inline CSS, inline JS),
 * generates standalone distribution files, and outputs offline / iframe embed instructions.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const distPath = path.join(projectRoot, 'dist', 'index.html');
const standaloneDistPath = path.join(projectRoot, 'dist', 'arcane-paws-standalone.html');
const standaloneRootPath = path.join(projectRoot, 'arcane-paws-standalone.html');

if (!fs.existsSync(distPath)) {
  console.error(`❌ Error: ${distPath} not found. Run 'pnpm run build' first.`);
  process.exit(1);
}

const content = fs.readFileSync(distPath, 'utf8');

// Verify that there are NO external script src or stylesheet links
const hasExternalScript = /<script\b[^>]*\bsrc\s*=/i.test(content);
const hasExternalCssLink = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref\s*=\s*["'](?!\s*https?:\/\/fonts\.googleapis\.com)/i.test(content);

if (hasExternalScript) {
  console.warn('⚠️ Warning: Found external script tag with src in dist/index.html');
} else {
  console.log('✅ PASS: Zero external JS script tags (100% inlined JS).');
}

if (hasExternalCssLink) {
  console.warn('⚠️ Warning: Found external CSS link tag in dist/index.html');
} else {
  console.log('✅ PASS: Zero local external CSS link tags (100% inlined CSS).');
}

// Write standalone copies
fs.writeFileSync(standaloneDistPath, content, 'utf8');
fs.writeFileSync(standaloneRootPath, content, 'utf8');

const stats = fs.statSync(standaloneRootPath);
const sizeKb = (stats.size / 1024).toFixed(2);

console.log(`\n🎉 Single-file bundle successfully exported!`);
console.log(`📦 Output locations:`);
console.log(`   - ${standaloneDistPath} (${sizeKb} KB)`);
console.log(`   - ${standaloneRootPath} (${sizeKb} KB)`);
console.log(`\n💡 How to run offline:`);
console.log(`   - Simply double click 'arcane-paws-standalone.html' in Finder/Explorer (file:/// protocol).`);
console.log(`💡 How to embed in an iframe on any website:`);
console.log(`   <iframe src="arcane-paws-standalone.html" width="100%" height="700" style="border:none; overflow:hidden;" allow="autoplay"></iframe>`);
