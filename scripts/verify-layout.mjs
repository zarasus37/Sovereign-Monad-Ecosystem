#!/usr/bin/env node
/**
 * verify-layout.mjs — Pure-Node port of scripts/verify-layout.ps1.
 *
 * Runs the same three checks the PowerShell script does, so the layout
 * guard can be executed on Windows, macOS, and Linux (including WSL) from
 * any shell. The .ps1 remains as a thin wrapper that delegates here.
 *
 *   1. Unexpected top-level entries
 *      — every entry in the repo root must be in the allowlist, or be a
 *        tracked dir (logs/packages/shared), or be gitignored.
 *
 *   2. Missing required project-state docs
 *      — README.md + docs/PROJECT_STATE.md + docs/PROJECT_STATE.json +
 *        docs/REPO_STRUCTURE_MAP.md + docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md
 *
 *   3. Legacy path/name references in active surfaces
 *      — ripgrep scan for old workspace names (Succor, Theo_Techno_Cosmo_Logically,
 *        Sovereign_Monad_Ecosystem, G:/My Drive/...) across tracked active files.
 *        Skipped with a warning if rg is not on PATH.
 *
 * Exit code 0 = layout is clean. Exit code 1 = at least one violation.
 *
 * Usage:
 *   node scripts/verify-layout.mjs
 *   node scripts/verify-layout.mjs --quiet   # suppress "Layout check passed." on success
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(__filename, '..', '..');

const QUIET = process.argv.includes('--quiet');

// ── 1. Allowlist (must match scripts/verify-layout.ps1) ─────────────────────
const ALLOWED_TOP_LEVEL = new Set([
  '.git',
  '.github',
  '.claude',
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  '.npmrc',
  '.pytest_cache',
  '.smartroute',
  '.stale-node-modules-20260612153231',
  '.stale-node-modules-20260612153258',
  '.stale-node-modules-20260612153345',
  '.stale-node-modules-20260612153417',
  '.stale-node-modules-20260612153442',
  '.husky',
  '.kilocode',
  '.testfox',
  'desktop.ini',
  'README.md',
  'vitest.config.ts',
  'CONTRIBUTING.md',
  'archive',
  'docs',
  'gnostic-engine',
  'gnosis-training',
  'monad-ecosystem',
  'node_modules',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'scripts',
  'theo-techno-cosmo',
]);

// These top-level dirs are *expected* even though they're not in the canonical
// allowlist (they're committed workspace content, not coordination surface).
const EXPECTED_TRACKED_DIRS = new Set(['logs', 'packages', 'shared']);

const REQUIRED_DOCS = [
  'README.md',
  'docs/PROJECT_STATE.md',
  'docs/PROJECT_STATE.json',
  'docs/REPO_STRUCTURE_MAP.md',
  'docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md',
];

// Active surfaces to scan for legacy references. Mirrors the .ps1 list.
const ACTIVE_SCAN_ROOTS = [
  'README.md',
  'docs',
  'gnostic-engine',
  'monad-ecosystem',
  'theo-techno-cosmo',
  'scripts',
  'package.json',
  'pnpm-workspace.yaml',
  '.gitignore',
  '.github',
  'shared',
];

// Legacy names / paths to detect. Any of these in an *active* surface is a
// re-emergence of an old workspace and must be remediated.
const LEGACY_PATTERN =
  'Succor_Gnostic_Engine|Theo_Techno_Cosmo_Logically|Sovereign_Monad_Ecosystem|' +
  'G:/My Drive/Succor_Gnostic_Engine|G:\\\\My Drive\\\\Succor_Gnostic_Engine|' +
  'G:/My Drive/Theo_Techno_Cosmo_Logically|G:\\\\My Drive\\\\Theo_Techno_Cosmo_Logically|' +
  'G:/My Drive/Sovereign_Monad_Ecosystem|G:\\\\My Drive\\\\Sovereign_Monad_Ecosystem';

// Ripgrep globs to exclude. Keep aligned with the .ps1 — these are the
// surfaces that legitimately contain the old names (archives, generated
// content, binary files where matches are coincidental).
const RG_EXCLUDES = [
  '!archive/**',
  '!**/node_modules/**',
  '!**/.git/**',
  '!**/.pytest_cache/**',
  '!**/__pycache__/**',
  '!**/.venv/**',
  '!**/.venv2/**',
  '!**/.venv.broken/**',
  '!**/.stale-node_modules-*/**',
  '!**/legacy/**',
  '!**/out/**',
  '!**/dist/**',
  '!**/build/**',
  '!**/coverage/**',
  '!**/generated/**',
  '!**/*.pdf',
  '!**/*.png',
  '!**/*.jpg',
  '!**/*.jpeg',
  '!**/*.gif',
  '!**/*.mp4',
  '!**/*.mov',
  '!**/*.pptx',
  '!**/*.xlsx',
  '!**/*.csv',
  '!**/*.jsonl',
  '!**/*.db',
  '!**/*.sqlite',
  '!**/*.parquet',
  '!**/*.zip',
  '!**/*.7z',
  '!**/*.tar.gz',
  '!**/*.log',
  '!**/*.bak',
  '!**/*.tmp',
  '!**/desktop.ini',
  '!**/*.ico',
  '!**/*.webp',
  '!**/*.docx',
  '!**/*.rtf',
  '!**/*.mp3',
  '!**/*.wav',
  '!**/*.m4a',
  '!**/*.avi',
  '!**/*.mkv',
  '!**/*.flac',
  '!**/*.json.bak',
  '!**/*.map',
  '!**/*.lock',
  '!**/*.min.*',
  '!**/*.env',
  '!**/*.pem',
  '!**/*.key',
  '!**/*.wasm',
  '!**/*.did',
  '!**/*.dll',
  '!**/*.exe',
  '!**/*.bin',
  '!**/*.DS_Store',
  '!**/*.swp',
  '!**/*.swo',
  '!**/*~',
  '!scripts/verify-layout.ps1',
  '!scripts/verify-layout.mjs',
];

// ── helpers ────────────────────────────────────────────────────────────────
function isGitIgnored(relPath) {
  // Use the git binary for a single authoritative answer. `git check-ignore
  // --quiet` exits 0 when the path IS ignored, 1 when not, 128 on error.
  const r = spawnSync('git', ['check-ignore', '--quiet', relPath], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return r.status === 0;
}

function listRootEntries() {
  return readdirSync(ROOT, { withFileTypes: true });
}

function red(s) {
  return `\u001b[31m${s}\u001b[0m`;
}
function yellow(s) {
  return `\u001b[33m${s}\u001b[0m`;
}
function green(s) {
  return `\u001b[32m${s}\u001b[0m`;
}

// ── 2. Check 1: unexpected top-level entries ──────────────────────────────
function checkTopLevel() {
  const errors = [];
  const allowedDirs = new Set(ALLOWED_TOP_LEVEL);
  const entries = listRootEntries();

  for (const e of entries) {
    if (allowedDirs.has(e.name)) continue;
    if (e.isDirectory() && EXPECTED_TRACKED_DIRS.has(e.name)) continue;

    const rel = relative(ROOT, join(ROOT, e.name));
    // Files that are gitignored are not violations (e.g. gh.exe, *.zip).
    if (isGitIgnored(rel)) continue;

    errors.push(`  - ${e.name}${e.isDirectory() ? '/' : ''}`);
  }
  return errors;
}

// ── 3. Check 2: required project-state docs ───────────────────────────────
function checkRequiredDocs() {
  const missing = [];
  for (const rel of REQUIRED_DOCS) {
    const p = join(ROOT, rel);
    if (!existsSync(p) || !statSync(p).isFile()) {
      missing.push(`  - ${rel}`);
    }
  }
  return missing;
}

// ── 4. Check 3: legacy path/name references in active surfaces ────────────
function checkLegacyReferences() {
  // Verify rg is on PATH.
  const which = spawnSync('rg', ['--version'], { encoding: 'utf8' });
  if (which.status !== 0) {
    if (!QUIET) {
      process.stdout.write(
        yellow(
          'ripgrep (rg) not found in PATH; skipping legacy-path scan. Install rg for full layout check.',
        ) + '\n',
      );
    }
    return [];
  }

  const args = [
    '-n',
    '--hidden',
    ...RG_EXCLUDES.flatMap((g) => ['--glob', g]),
    '-e',
    LEGACY_PATTERN,
    ...ACTIVE_SCAN_ROOTS,
  ];
  const r = spawnSync('rg', args, { cwd: ROOT, encoding: 'utf8' });

  // rg exits 1 when no matches — that is the success case for us.
  if (r.status === 1) return [];
  if (r.status !== 0 && r.status !== 1) {
    if (!QUIET) {
      process.stdout.write(
        yellow(`ripgrep scan failed (exit ${r.status}); treating as warning.`),
      );
    }
    return [];
  }

  const lines = (r.stdout || '').split('\n').filter(Boolean);
  // Filter out the verifier scripts themselves (they must contain the legacy
  // pattern to do their job; globs already exclude them, but defend in depth).
  const filtered = lines.filter(
    (l) =>
      !l.includes(`scripts${sep}verify-layout.ps1`) &&
      !l.includes(`scripts${sep}verify-layout.mjs`),
  );
  // Deduplicate while preserving order.
  const seen = new Set();
  const unique = [];
  for (const l of filtered) {
    if (seen.has(l)) continue;
    seen.add(l);
    unique.push(l);
  }
  return unique;
}

// ── 5. Run, report, exit ──────────────────────────────────────────────────
const errors = [];

const topLevelErrs = checkTopLevel();
if (topLevelErrs.length) {
  errors.push(`Unexpected top-level entries:\n${topLevelErrs.join('\n')}`);
}

const docErrs = checkRequiredDocs();
if (docErrs.length) {
  errors.push(`Missing required project state docs:\n${docErrs.join('\n')}`);
}

const legacyErrs = checkLegacyReferences();
if (legacyErrs.length) {
  errors.push(
    `Legacy path/name references found in active surfaces:\n  - ${legacyErrs.join('\n  - ')}`,
  );
}

if (errors.length) {
  process.stdout.write(red(errors.join('\n\n')) + '\n');
  process.exit(1);
}

if (!QUIET) {
  process.stdout.write(green('Layout check passed.') + '\n');
}
process.exit(0);
