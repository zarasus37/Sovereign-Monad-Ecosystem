#!/usr/bin/env node
/**
 * CLI entry point for the HCD monitor.
 *
 * Usage:
 *   node dist/cli.js
 *     --queue logs/audit/human_review_queue.md
 *     --correction-log logs/audit/correction_log_v5.10.json
 *     --bus-log monad-ecosystem/packages/gnosis-core/logs/signal-stream.jsonl
 *     --out logs/audit/human_capability_drift_2026-06-26.json
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseHumanReviewQueue } from './parsers/human-review-queue.js';
import { parseCorrectionLog } from './parsers/correction-log.js';
import { parseBusLog } from './parsers/bus-log.js';
import { buildReport, reportToJson } from './report.js';

interface CliArgs {
  queuePath?: string;
  correctionLogPath?: string;
  busLogPath?: string;
  outPath?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--queue':
        args.queuePath = argv[++i];
        break;
      case '--correction-log':
        args.correctionLogPath = argv[++i];
        break;
      case '--bus-log':
        args.busLogPath = argv[++i];
        break;
      case '--out':
        args.outPath = argv[++i];
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
        break;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.queuePath || !args.correctionLogPath) {
    console.error(
      'Usage: node dist/cli.js --queue <path> --correction-log <path> [--bus-log <path>] [--out <path>]'
    );
    process.exit(1);
  }

  const queueMarkdown = await readFile(resolve(args.queuePath), 'utf-8');
  const queue = parseHumanReviewQueue(queueMarkdown, args.queuePath);

  const correctionRaw = JSON.parse(
    await readFile(resolve(args.correctionLogPath), 'utf-8')
  );
  const correctionLog = parseCorrectionLog(correctionRaw, args.correctionLogPath);

  let busEvents: Awaited<ReturnType<typeof parseBusLog>>['events'] = [];
  let busSkipped = 0;
  if (args.busLogPath) {
    const busRaw = await readFile(resolve(args.busLogPath), 'utf-8');
    const parsed = parseBusLog(busRaw);
    busEvents = parsed.events;
    busSkipped = parsed.skipped;
  }

  const report = buildReport({
    queue,
    correctionLog,
    busEvents,
    queuePath: args.queuePath,
    correctionLogPath: args.correctionLogPath,
    busLogPath: args.busLogPath,
  });

  if (busSkipped > 0) {
    report.warnings.push(`Bus log parsing skipped ${busSkipped} malformed lines.`);
  }

  const json = reportToJson(report);

  if (args.outPath) {
    await writeFile(resolve(args.outPath), json + '\n', 'utf-8');
    console.log(`Drift report written to ${args.outPath}`);
  } else {
    console.log(json);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
