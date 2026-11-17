// Entrypoint for the makefun-frontend-01 submission.
//
// The deliverable itself is the static site under app/: plain HTML, CSS
// and ES modules that a browser opens directly, with no bundling step in
// between. This script is only the hand-in step the grader runs. It
// stages the site (plus the screenshot set, when the repo carries one)
// into the output directory, then asks the vendored make.fun library to
// describe the staged tree in dossier.json, which is what the judge
// scores from.
//
// Run it the way the grader does:
//   node main.ts
// Outside the grading container, MAKEFUN_OUTPUT_DIR names the output
// directory in place of the default /output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// Caps handed to the dossier builder. They mirror the limits the scorer
// enforces, so an oversized entry trips here first instead of only
// being refused after submission.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
};

const rootDir = dirname(fileURLToPath(import.meta.url));
const targetDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy one directory tree into another, creating the destination first.
function stageTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

// Count the regular files below a directory; feeds the summary line.
function countStagedFiles(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countStagedFiles(join(dir, entry.name));
    else if (entry.isFile()) total += 1;
  }
  return total;
}

function handIn(): void {
  const appSource = join(rootDir, 'app');
  if (!existsSync(appSource)) {
    throw new Error('cannot hand in: this entry has no app/ directory to stage');
  }

  mkdirSync(targetDir, { recursive: true });
  stageTree(appSource, join(targetDir, 'app'));

  // The output always gets a screenshots/ folder; its contents are
  // copied over only when the repo actually carries screenshots.
  const shotsTarget = join(targetDir, 'screenshots');
  mkdirSync(shotsTarget, { recursive: true });
  const shotsSource = join(rootDir, 'screenshots');
  if (existsSync(shotsSource)) stageTree(shotsSource, shotsTarget);

  const dossierPath = join(targetDir, 'dossier.json');
  writeFileSync(dossierPath, buildDossier(targetDir, DOSSIER_CAPS));

  // A zero-byte dossier would mean the hand-in silently produced
  // nothing for the judge, so fail loudly instead of reporting success.
  const dossierBytes = statSync(dossierPath).size;
  if (dossierBytes === 0) {
    throw new Error('cannot hand in: dossier.json came out empty');
  }

  const staged = countStagedFiles(join(targetDir, 'app'));
  console.log(`handed in: ${staged} app file(s) staged in ${targetDir}; dossier.json is ${dossierBytes} bytes`);
}

handIn();
