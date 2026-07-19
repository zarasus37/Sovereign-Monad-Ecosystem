/**
 * Paper-trading journal + daily review for tier-1 LOGOC protocol.
 * Append-only JSONL under logs/paper-trading/ (or package-local data/).
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { LOGOCTradeEvent } from './logocTrade.js';
import {
  SYNTHETIC_ACCOUNT_DEFAULT,
  stampProtocol,
  closeTrade,
  buildEntryEvent,
  type TradePlanInput,
} from './logocTrade.js';
import type { DailyReviewPLEvent, LogocPaperTradePLEvent, PLState } from './types.js';
import { PLLedger } from './plLedger.js';
import { MandateIssuer } from './mandateIssuer.js';
import type { ACLMandate } from './types.js';

function defaultJournalPath(): string {
  // repo root logs/paper-trading/
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '../../../../logs/paper-trading/cris-colon-agent0.jsonl');
}

function defaultSessionPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '../../../../logs/paper-trading/session-state.json');
}

export interface PaperSessionState {
  principal_id: string;
  agent_id: string;
  domain: string;
  synthetic_account_size: number;
  last_loss_at: number | null;
  last_loss_size: number | null;
  open_trade_id: string | null;
  pl_events_count: number;
}

export interface DailyReviewInput {
  review_date: string; // YYYY-MM-DD
  behavioral_pattern: string;
  micro_rule_upgrade: string;
  notes?: string;
}

export interface DailyReviewRecord {
  kind: 'daily_review';
  review_date: string;
  principal_id: string;
  agent_id: string;
  trade_count: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  avg_R: number;
  max_drawdown_R: number;
  behavioral_pattern: string;
  micro_rule_upgrade: string;
  notes: string | null;
  at: number;
}

export class PaperTradingJournal {
  readonly journalPath: string;
  readonly sessionPath: string;
  private session: PaperSessionState;
  private openTrades = new Map<string, LOGOCTradeEvent>();

  constructor(
    private readonly ledger: PLLedger,
    private readonly issuer: MandateIssuer,
    opts?: {
      journalPath?: string;
      sessionPath?: string;
      principalId?: string;
      agentId?: string;
    },
  ) {
    this.journalPath = opts?.journalPath ?? defaultJournalPath();
    this.sessionPath = opts?.sessionPath ?? defaultSessionPath();
    this.session = this.loadSession(opts);
  }

  private loadSession(opts?: {
    principalId?: string;
    agentId?: string;
  }): PaperSessionState {
    if (existsSync(this.sessionPath)) {
      try {
        return JSON.parse(readFileSync(this.sessionPath, 'utf8')) as PaperSessionState;
      } catch {
        /* fall through */
      }
    }
    return {
      principal_id: opts?.principalId ?? 'principal:cris-colon',
      agent_id: opts?.agentId ?? '0x995e680959d8547e69ad905c9da415dd9c0dc542e83946da7c5571a6cf19184d',
      domain: 'trading',
      synthetic_account_size: SYNTHETIC_ACCOUNT_DEFAULT,
      last_loss_at: null,
      last_loss_size: null,
      open_trade_id: null,
      pl_events_count: 0,
    };
  }

  private saveSession(): void {
    const dir = dirname(this.sessionPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.sessionPath, JSON.stringify(this.session, null, 2), 'utf8');
  }

  private appendJournal(row: unknown): void {
    const dir = dirname(this.journalPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(this.journalPath, `${JSON.stringify(row)}\n`, 'utf8');
  }

  getSession(): PaperSessionState {
    return { ...this.session };
  }

  listTrades(): LOGOCTradeEvent[] {
    if (!existsSync(this.journalPath)) return [];
    const lines = readFileSync(this.journalPath, 'utf8').split(/\r?\n/).filter(Boolean);
    const out: LOGOCTradeEvent[] = [];
    for (const line of lines) {
      try {
        const row = JSON.parse(line) as { kind?: string } & LOGOCTradeEvent;
        if (row.kind === 'daily_review') continue;
        if (row.event_id && row.instrument) out.push(row as LOGOCTradeEvent);
      } catch {
        /* skip */
      }
    }
    return out;
  }

  /**
   * Open a paper trade — validates protocol Rules 1–3 before journal write.
   * Does not credit PL until close (process complete).
   */
  openTrade(
    plan: Omit<TradePlanInput, 'principal_id' | 'agent_id' | 'synthetic_account_size'> & {
      principal_id?: string;
      agent_id?: string;
    },
    now: number = Date.now(),
  ): { ok: true; event: LOGOCTradeEvent } | { ok: false; violations: string[]; event: LOGOCTradeEvent } {
    if (this.session.open_trade_id) {
      return {
        ok: false,
        violations: ['open_trade_already_exists'],
        event: {} as LOGOCTradeEvent,
      };
    }

    const raw = buildEntryEvent(
      {
        ...plan,
        principal_id: plan.principal_id ?? this.session.principal_id,
        agent_id: plan.agent_id ?? this.session.agent_id,
        synthetic_account_size: this.session.synthetic_account_size,
      },
      new Date(now),
    );

    const stamped = stampProtocol(raw, {
      lastLossAt: this.session.last_loss_at,
      lastLossSize: this.session.last_loss_size,
      now,
    });

    if (!stamped.protocol_valid) {
      return {
        ok: false,
        violations: stamped.protocol_violations ?? ['protocol_invalid'],
        event: stamped,
      };
    }

    this.openTrades.set(stamped.event_id, stamped);
    this.session.open_trade_id = stamped.event_id;
    this.saveSession();
    this.appendJournal({ kind: 'trade_open', ...stamped });
    return { ok: true, event: stamped };
  }

  /**
   * Close open trade → full LOGOC event → PL credit if process-valid.
   */
  closeOpenTrade(
    exit: {
      exit_price: number;
      exit_reason: string;
      logoc_note: string;
      lesson: string;
    },
    now: number = Date.now(),
  ): {
    ok: boolean;
    event?: LOGOCTradeEvent;
    pl?: PLState;
    mandate?: ACLMandate;
    violations?: string[];
  } {
    const id = this.session.open_trade_id;
    if (!id) return { ok: false, violations: ['no_open_trade'] };
    const open = this.openTrades.get(id);
    if (!open) return { ok: false, violations: ['open_trade_not_in_memory'] };

    let closed = closeTrade(open, exit, new Date(now));
    closed = stampProtocol(closed, {
      lastLossAt: this.session.last_loss_at,
      lastLossSize: this.session.last_loss_size,
      now,
    });

    // Closed trades need logoc_note + lesson
    const extra: string[] = [...(closed.protocol_violations ?? [])];
    if (!exit.logoc_note || exit.logoc_note.length < 15) {
      extra.push('missing_logoc_note');
    }
    if (!exit.lesson || exit.lesson.length < 10) {
      extra.push('missing_lesson');
    }
    if (!exit.logoc_note.toLowerCase().includes('theotechnocosmologic') &&
        !exit.logoc_note.toLowerCase().includes('ttcl') &&
        !exit.logoc_note.toLowerCase().includes('theo')) {
      // soft: encourage TTCL line
      if (!exit.logoc_note.toLowerCase().includes('discipline') &&
          !exit.logoc_note.toLowerCase().includes('risk')) {
        extra.push('logoc_note_should_name_tested_quality');
      }
    }

    const processValid = extra.filter((x) => x !== 'logoc_note_should_name_tested_quality').length === 0
      && (closed.protocol_violations?.length ?? 0) === 0;

    closed = {
      ...closed,
      protocol_valid: processValid,
      protocol_violations: extra,
      pl_score_delta: processValid ? 3.0 : 0,
    };

    this.appendJournal({ kind: 'trade_close', ...closed });
    this.openTrades.delete(id);
    this.session.open_trade_id = null;

    if (closed.realized_R != null && closed.realized_R < 0) {
      this.session.last_loss_at = now;
      this.session.last_loss_size = closed.position_size;
    }
    this.saveSession();

    if (!processValid) {
      return { ok: false, event: closed, violations: closed.protocol_violations };
    }

    // PL credit — process quality, not win rate
    const processScore =
      (exit.lesson.length >= 20 ? 0.5 : 0.3) +
      (exit.logoc_note.length >= 20 ? 0.5 : 0.3);
    const plEvent: LogocPaperTradePLEvent = {
      kind: 'logoc_paper_trade',
      eventId: randomUUID(),
      principalId: this.session.principal_id,
      domain: 'trading',
      tradeEventId: closed.event_id,
      points: 3,
      processScore: Math.min(1, processScore),
      verifiedBy: 'task-verifier',
      at: now,
    };
    const pl = this.ledger.append(plEvent, now);
    this.session.pl_events_count += 1;
    this.saveSession();
    const mandate = this.issuer.issueFromPL(pl, now);

    return { ok: true, event: closed, pl, mandate };
  }

  /** Daily review ritual → small PL credit + journal row. */
  dailyReview(
    input: DailyReviewInput,
    now: number = Date.now(),
  ): { review: DailyReviewRecord; pl: PLState; mandate: ACLMandate } {
    const trades = this.listTrades().filter((t) => t.exit_price != null);
    const closed = trades;
    const wins = closed.filter((t) => (t.realized_R ?? 0) > 0);
    const losses = closed.filter((t) => (t.realized_R ?? 0) < 0);
    const Rs = closed.map((t) => t.realized_R ?? 0);
    const avg_R = Rs.length ? Rs.reduce((a, b) => a + b, 0) / Rs.length : 0;

    // Max drawdown in R (running sum trough)
    let peak = 0;
    let eq = 0;
    let maxDd = 0;
    for (const r of Rs) {
      eq += r;
      if (eq > peak) peak = eq;
      const dd = peak - eq;
      if (dd > maxDd) maxDd = dd;
    }

    if (input.behavioral_pattern.trim().length < 15) {
      throw new Error('daily_review: behavioral_pattern too thin');
    }
    if (input.micro_rule_upgrade.trim().length < 15) {
      throw new Error('daily_review: micro_rule_upgrade too thin');
    }

    const review: DailyReviewRecord = {
      kind: 'daily_review',
      review_date: input.review_date,
      principal_id: this.session.principal_id,
      agent_id: this.session.agent_id,
      trade_count: closed.length,
      win_count: wins.length,
      loss_count: losses.length,
      win_rate: closed.length ? wins.length / closed.length : 0,
      avg_R: Math.round(avg_R * 1000) / 1000,
      max_drawdown_R: Math.round(maxDd * 1000) / 1000,
      behavioral_pattern: input.behavioral_pattern,
      micro_rule_upgrade: input.micro_rule_upgrade,
      notes: input.notes ?? null,
      at: now,
    };
    this.appendJournal(review);

    const plEvent: DailyReviewPLEvent = {
      kind: 'daily_review',
      eventId: randomUUID(),
      principalId: this.session.principal_id,
      domain: 'trading',
      reviewDate: input.review_date,
      tradeCount: closed.length,
      points: 5,
      verifiedBy: 'task-verifier',
      at: now,
    };
    const pl = this.ledger.append(plEvent, now);
    const mandate = this.issuer.issueFromPL(pl, now);
    return { review, pl, mandate };
  }
}
