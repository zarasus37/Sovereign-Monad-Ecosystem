import { ExecutionTruthValidator } from './evaluator';
import * as path from 'path';

// Assuming running from within packages/execution-truth-core
const workspaceRoot = path.resolve(__dirname, '../../');
const validator = new ExecutionTruthValidator(workspaceRoot);

console.log('--- Sovereign Monad Ecosystem ---');
console.log('Execution-Truth Core Evaluator');
console.log('Validating runtime execution-truth closure...\n');

const result = validator.evaluate();

console.log(`- Phase 1a Proof Recorded: ${result.hasPhase1aProof ? 'PASSED' : 'FAILED'}`);
console.log(`- Bootstrap Source Registration: ${result.hasBootstrapSource ? 'PASSED' : 'FAILED'}`);
console.log(`- Runtime Hardening Implemented: ${result.hasRuntimeHardening ? 'PASSED' : 'FAILED'}`);
console.log(`- Guarded-Live Documentation: ${result.hasGuardedLiveDocs ? 'PASSED' : 'FAILED'}`);
console.log(`- Observed Execution Record: ${result.hasExecutionRecord ? 'PASSED' : 'FAILED'}\n`);

if (result.isReady) {
    console.log('STATUS: READY');
    console.log('All criteria for runtime execution-truth closure met.');
} else {
    console.log('STATUS: NOT READY');
    console.log('Gaps still exist in the runtime execution-truth closure.');
    process.exit(1);
}
