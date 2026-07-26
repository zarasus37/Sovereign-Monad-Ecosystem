/**
 * Lesson engine domain types — docs/Shaliah Agents/Lesson Engine Data Model.md
 * + docs/Shaliah Agents/Lesson Architecture.md
 */

export type LessonPhase =
  | 'orient'
  | 'model'
  | 'retrieve'
  | 'feedback'
  | 'fade'
  | 'interleave'
  | 'delay'
  | 'transfer'
  | 'gate'
  | 'complete';

export type MasteryState =
  | 'novice'
  | 'guided'
  | 'practiced'
  | 'delayed'
  | 'transferable'
  | 'mastered';

export type IntegrityFocus = 'N' | 'C' | 'P' | 'NCP';

export interface LessonDefinition {
  readonly id: string;
  readonly title: string;
  readonly gate: 'fg1' | 'fg2' | 'fg3' | 'door' | 'general';
  readonly deepRule: string;
  readonly surface: string;
  readonly objective: string;
  readonly modelExample: string;
  readonly retrievePrompt: string;
  readonly selfExplainPrompt: string;
  readonly interleavePrompt: string;
  readonly transferPrompt: string;
  readonly delayMs: number;
  readonly integrityFocus: IntegrityFocus;
  readonly shaliahOffice: ShaliahOfficeId;
  /** Keywords / concepts expected in retrieval (case-insensitive substring match). */
  readonly retrieveKeys: readonly string[];
  /** Keywords expected in transfer response. */
  readonly transferKeys: readonly string[];
  /** Keywords expected in self-explanation. */
  readonly explainKeys: readonly string[];
}

export type ShaliahOfficeId =
  | 'extension'
  | 'coach'
  | 'mirror'
  | 'attention_shield'
  | 'transactional_vehicle';

export interface Attempt {
  readonly id: string;
  readonly lessonId: string;
  readonly phase: LessonPhase;
  readonly response: string;
  readonly at: number;
  readonly latencyMs: number;
  readonly hintsUsed: number;
  readonly correct: boolean;
  readonly explanationQuality: number;
}

export interface TutorAction {
  readonly id: string;
  readonly lessonId: string;
  readonly at: number;
  readonly selectedPrompt: string;
  readonly rationale: string;
  readonly nextPhase: LessonPhase;
  readonly scaffoldLevel: number;
  readonly interleaving: boolean;
}

export interface MasteryEvent {
  readonly id: string;
  readonly principalId: string;
  readonly lessonId: string;
  readonly gate: LessonDefinition['gate'];
  readonly at: number;
  readonly delayedTransfer: boolean;
  readonly score: number;
  /** Placeholder until Integrity Auditor wires real signatures. */
  readonly integritySignature: string;
  readonly domainTags: readonly string[];
}

export interface LessonRuntime {
  readonly principalId: string;
  readonly lesson: LessonDefinition;
  phase: LessonPhase;
  mastery: MasteryState;
  scaffoldLevel: number;
  startedAt: number;
  modelSeenAt?: number;
  retrievePassedAt?: number;
  explainPassedAt?: number;
  interleavePassedAt?: number;
  delaySatisfiedAt?: number;
  transferPassedAt?: number;
  attempts: Attempt[];
  tutorActions: TutorAction[];
  masteryEvent?: MasteryEvent;
  lastFeedback?: string;
}

export interface LessonSubmitResult {
  readonly ok: boolean;
  readonly phase: LessonPhase;
  readonly mastery: MasteryState;
  readonly feedback: string;
  readonly correct: boolean;
  readonly masteryEvent?: MasteryEvent;
}
