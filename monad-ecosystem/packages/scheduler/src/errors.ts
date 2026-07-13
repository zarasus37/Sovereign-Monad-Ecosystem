/**
 * @sovereign/scheduler — the TTCL Layer 6 Scheduler.
 *
 * Errors are *configuration / load errors*: they surface when a wheel registry
 * fails its JSON Schema validation or its cross-reference integrity check, or
 * when a generated schedule fails its output-schema validation. None of
 * these reach a successful optimization run. They mirror the @sovereign/compiler
 * compile-error discipline (a typed error at load time, not a runtime surprise).
 */

/** Base class for every scheduler failure. */
export class SchedulerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulerError";
  }
}

/**
 * A wheel registry failed its JSON Schema validation. Carries the ajv error
 * list so the caller can report which fields were malformed.
 */
export class RegistrySchemaError extends SchedulerError {
  readonly errors: readonly { instancePath: string; schemaPath: string; message?: string }[];
  constructor(
    errors: readonly { instancePath: string; schemaPath: string; message?: string }[],
  ) {
    const summary = errors
      .map((e) => `${e.instancePath || "<root>"}: ${e.message ?? "invalid"}`)
      .join("; ");
    super(`wheel-registry schema validation failed — ${summary}`);
    this.name = "RegistrySchemaError";
    this.errors = errors;
  }
}

/**
 * A wheel registry passed its schema but failed a cross-reference integrity
 * check: a facet/pair references an undeclared wheel, two wheels share a name,
 * a facet's wheel does not actually cover that domain, or a pair table has a
 * duplicate id. These constraints are not expressible in plain draft-07 and are
 * enforced here.
 */
export class RegistryIntegrityError extends SchedulerError {
  constructor(message: string) {
    super(message);
    this.name = "RegistryIntegrityError";
  }
}

/**
 * A generated schedule failed its output JSON Schema validation. This signals
 * a scheduler bug (the optimizer produced a malformed artifact), not a bad
 * input — it should be unreachable in practice and is asserted in the facade.
 */
export class ScheduleSchemaError extends SchedulerError {
  readonly errors: readonly { instancePath: string; schemaPath: string; message?: string }[];
  constructor(
    errors: readonly { instancePath: string; schemaPath: string; message?: string }[],
  ) {
    const summary = errors
      .map((e) => `${e.instancePath || "<root>"}: ${e.message ?? "invalid"}`)
      .join("; ");
    super(`canonical-schedule schema validation failed — ${summary}`);
    this.name = "ScheduleSchemaError";
    this.errors = errors;
  }
}