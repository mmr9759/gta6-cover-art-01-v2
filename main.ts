// Vice State Cover Studio — entry program for the make.fun GTA 6 Cover Art bounty.
// Node 22, standard library only. It hands the app in: it copies this repository's
// app/ and screenshots/ into the output directory and writes dossier.json there
// with the vendored make.fun dossier builder. Outside the grader, the output
// directory is MAKEFUN_OUTPUT_DIR instead of /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countEntries(dir: string): number {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    total += 1;
    if (statSync(full).isDirectory()) total += countEntries(full);
  }
  return total;
}

mkdirSync(outputDir, { recursive: true });

// The app: plain static files under app/, loaded offline by desktop Chrome.
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });

// The screenshots: 3 or 4 images, the first by name is the cover.
const shotDir = join(repoRoot, 'screenshots');
if (existsSync(shotDir)) {
  const shots = readdirSync(shotDir).filter((n) => !n.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
  }
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  cpSync(shotDir, join(outputDir, 'screenshots'), { recursive: true });
}

// Guard the gate's own caps before the dossier is built, so a bad bundle
// fails loudly here instead of silently at the scorer.
const appEntries = countEntries(join(outputDir, 'app'));
if (appEntries > 993) throw new Error(`app/ holds ${appEntries} entries, over the 993 cap`);

// The dossier the judge reads: built by the kit's vendored library, unchanged.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
