import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));

/** Package root (…/meshaleach-zk) whether running from src/ or dist/. */
export function packageRoot(): string {
  // dist/index.js → ../  or src/paths.ts → ../
  return join(here, '..');
}

export function artifactPaths() {
  const root = packageRoot();
  return {
    wasm: join(root, 'artifacts', 'gate_human_bound.wasm'),
    zkey: join(root, 'artifacts', 'gate_human_bound.zkey'),
    vkey: join(root, 'artifacts', 'verification_key.json'),
    meta: join(root, 'artifacts', 'circuit_meta.json'),
  };
}

export function artifactsReady(): boolean {
  const a = artifactPaths();
  return existsSync(a.wasm) && existsSync(a.zkey) && existsSync(a.vkey);
}
