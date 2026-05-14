#!/usr/bin/env node
/**
 * Idiot-proof copy stockfish WASM + worker JS iz node_modules u public/stockfish/.
 * Pokreće se automatski preko `prebuild` npm script-a — Docker `npm run build`
 * ce isto okidati. Bez ovoga, /stockfish/ url-ovi koji se ucitavaju iz
 * ChessGame.tsx ne bi imali nijedan target fajl u dist/-u.
 *
 * Koristimo "lite-single" variantu (5MB WASM) jer:
 *   - "single" znaci single-threaded — ne treba SharedArrayBuffer +
 *     cross-origin-isolated headers (uprostili bismo nginx.conf i dev server)
 *   - "lite" znaci bez NNUE neural-network blok-a (puna varijanta je 30MB+) —
 *     gubi se ~150 Elo ali idemo do depth 14 bez problema za KT3 demo-test
 */
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'node_modules', 'stockfish', 'bin');
const DEST_DIR = path.join(__dirname, '..', 'public', 'stockfish');
const FILES = ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm'];

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`[copy-stockfish] node_modules/stockfish/bin not found — pokreni 'npm install' prvo.`);
    process.exit(1);
  }
  fs.mkdirSync(DEST_DIR, { recursive: true });

  let copied = 0;
  for (const f of FILES) {
    const src = path.join(SRC_DIR, f);
    const dest = path.join(DEST_DIR, f);
    if (!fs.existsSync(src)) {
      console.error(`[copy-stockfish] missing source: ${src}`);
      process.exit(1);
    }
    // Skip ako je vec na destinaciji i isti mtime (skraćuje rebuild-ove)
    if (fs.existsSync(dest)) {
      const srcStat = fs.statSync(src);
      const destStat = fs.statSync(dest);
      if (srcStat.mtimeMs === destStat.mtimeMs && srcStat.size === destStat.size) {
        continue;
      }
    }
    fs.copyFileSync(src, dest);
    // Preserve mtime za skip optimizaciju
    const srcStat = fs.statSync(src);
    fs.utimesSync(dest, srcStat.atime, srcStat.mtime);
    copied++;
  }
  if (copied > 0) {
    console.log(`[copy-stockfish] kopirano ${copied}/${FILES.length} fajla u ${path.relative(process.cwd(), DEST_DIR)}/`);
  }
}

main();
