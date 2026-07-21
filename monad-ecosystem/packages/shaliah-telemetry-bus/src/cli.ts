#!/usr/bin/env node
/**
 * CLI entry point for shaliah-telemetry-bus.
 *
 * Usage:
 *   node dist/cli.js --input telemetry.jsonl --output bus-events.jsonl
 *   node dist/cli.js --input telemetry.jsonl --output bus-events.jsonl --metrics
 *   node dist/cli.js --input telemetry.jsonl --stream | pipe to hcd-monitor
 */

import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseShaliahTelemetry, type ShaliahTelemetryParseResult } from './parser.js';

interface CliArgs {
  input?: string;
  output?: string;
  metrics?: boolean;
  stream?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--input':
        args.input = argv[++i];
        break;
      case '--output':
        args.output = argv[++i];
        break;
      case '--metrics':
        args.metrics = true;
        break;
      case '--stream':
        args.stream = true;
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

function printMetrics(result: ShaliahTelemetryParseResult): void {
  // Events by kind
  const byKind = new Map<string, number>();
  for (const evt of result.events) {
    byKind.set(evt.type, (byKind.get(evt.type) ?? 0) + 1);
  }

  console.log('\n=== Shaliah Telemetry Summary ===');
  console.log(`Total events: ${result.events.length}`);
  console.log(`Skipped: ${result.skipped}`);

  console.log('\nEvents by kind:');
  for (const [kind, count] of byKind) {
    console.log(`  ${kind}: ${count}`);
  }

  // Events by source (phase)
  const bySource = new Map<string, number>();
  for (const evt of result.events) {
    bySource.set(evt.source, (bySource.get(evt.source) ?? 0) + 1);
  }

  console.log('\nEvents by phase:');
  for (const [source, count] of bySource) {
    console.log(`  ${source}: ${count}`);
  }

  // Severity breakdown
  const bySeverity = new Map<string, number>();
  for (const evt of result.events) {
    bySeverity.set(evt.severity ?? 'info', (bySeverity.get(evt.severity ?? 'info') ?? 0) + 1);
  }

  console.log('\nEvents by severity:');
  for (const [sev, count] of bySeverity) {
    console.log(`  ${sev}: ${count}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input) {
    console.error(`
Shaliah Telemetry → hcd-monitor BusEvent Adapter

Usage:
  node dist/cli.js --input <file> [--output <file>] [--metrics] [--stream]

Options:
  --input <file>   Input JSONL file from Shaliah Onboarding
  --output <file>  Output BusEvents JSONL file (optional)
  --metrics        Print summary metrics to stdout
  --stream         Stream output line-by-line (for piping)

Examples:
  # Batch process
  node dist/cli.js --input logs/telemetry.jsonl --output logs/bus-events.jsonl --metrics

  # Stream to hcd-monitor
  node dist/cli.js --input logs/telemetry.jsonl --stream | hcd-monitor --bus-log -
`);
    process.exit(1);
  }

  // Check if input file exists
  try {
    await stat(args.input);
  } catch {
    console.error(`Input file not found: ${args.input}`);
    process.exit(1);
  }

  const content = await readFile(resolve(args.input), 'utf-8');
  const result = parseShaliahTelemetry(content);

  if (args.metrics) {
    printMetrics(result);
  } else {
    console.error(`Parsed ${result.events.length} events, ${result.skipped} skipped`);
  }

  if (result.errors.length > 0 && !args.metrics) {
    console.warn('First 5 errors:');
    for (const err of result.errors.slice(0, 5)) {
      console.warn(`  - ${err}`);
    }
  }

  if (args.stream) {
    // Stream output line by line (for piping)
    for (const event of result.events) {
      console.log(JSON.stringify(event));
    }
  } else if (args.output) {
    const jsonl = result.events.map(e => JSON.stringify(e)).join('\n');
    await writeFile(resolve(args.output), jsonl + '\n', 'utf-8');
    console.log(`Bus events written to ${args.output}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});