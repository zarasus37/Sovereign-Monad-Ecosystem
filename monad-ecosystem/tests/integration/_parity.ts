/**
 * Layer 7.8 cross-runtime parity — Python shim spawn helper.
 *
 * The TS parity tests (classifier / scorer / tier) each spawn the canonical
 * Python reference implementations through `gnostic-engine/tests/_parity_shim.py`
 * and assert the two runtimes agree. This helper centralizes the spawn: it
 * resolves the shim + gnostic-engine project paths from this file's location,
 * invokes `uv run --project <gnostic-engine> python <shim> <mode>` with a JSON
 * stdin payload, and parses the trailing JSON object the shim writes to stdout.
 *
 * `uv run` pins the project interpreter (Python 3.11) and makes the
 * `gnostic_engine` package importable; the shim ALSO bootstraps `src/` onto
 * sys.path itself so it works under a plain `python` if `uv` is ever absent.
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// monad-ecosystem/tests/integration → repo root
const REPO_ROOT = resolve(here, '../../..');
const GNOSTIC_ENGINE = resolve(REPO_ROOT, 'gnostic-engine');
const SHIM = resolve(GNOSTIC_ENGINE, 'tests/_parity_shim.py');

/** Parse the trailing JSON object out of the shim's stdout (uv may prepend noise). */
function parseShimStdout(stdout: string): any {
  const trimmed = stdout.trim();
  const match = trimmed.match(/\{[\s\S]*\}\s*$/);
  if (!match) {
    throw new Error(
      `parity shim produced no JSON object on stdout.\n--- stdout ---\n${stdout}\n--- end ---`,
    );
  }
  return JSON.parse(match[0]);
}

/**
 * Run the parity shim in the given mode with a JSON-serializable input.
 * Returns the parsed JSON object the shim writes to stdout. Throws if the
 * shim exits non-zero, times out (60s), or emits no parseable JSON.
 */
export function runParityShim(mode: string, input: unknown): any {
  const res = spawnSync(
    'uv',
    ['run', '--project', GNOSTIC_ENGINE, 'python', SHIM, mode],
    {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      cwd: REPO_ROOT,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      timeout: 60_000,
    },
  );
  if (res.error) {
    throw new Error(`parity shim spawn failed (${mode}): ${res.error.message}`);
  }
  if (res.status !== 0) {
    throw new Error(
      `parity shim exited ${res.status} (${mode})\n--- stderr ---\n${res.stderr}\n--- end ---`,
    );
  }
  const out = parseShimStdout(res.stdout);
  if (out && typeof out === 'object' && 'error' in out && Object.keys(out).length === 1) {
    throw new Error(`parity shim error (${mode}): ${out.error}`);
  }
  return out;
}

/** Absolute repo-root path, exposed for fixture resolution in the tests. */
export const repoRoot = REPO_ROOT;