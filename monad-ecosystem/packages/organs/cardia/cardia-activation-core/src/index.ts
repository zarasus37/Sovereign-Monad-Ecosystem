import path from 'path';
import { buildCardiaActivationSnapshot, loadLocalCardiaActivationSnapshot } from './snapshot';
import {
  CardiaActivationInput,
  CardiaActivationPolicy,
  CardiaActivationRecord,
  CardiaActivationSnapshot,
  CardiaActivationStatus,
} from './types';

export { buildCardiaActivationSnapshot, loadLocalCardiaActivationSnapshot };
export type {
  CardiaActivationInput,
  CardiaActivationPolicy,
  CardiaActivationRecord,
  CardiaActivationSnapshot,
  CardiaActivationStatus,
};

function main() {
  const snapshot = loadLocalCardiaActivationSnapshot(path.resolve(__dirname, '..', '..'));
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exitCode = 1;
  }
}
