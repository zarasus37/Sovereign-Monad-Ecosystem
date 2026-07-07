/**
 * Shared TTCL runtime errors.
 *
 * `UnknownSignClassError` is raised by every runtime path that validates a
 * `sign_class_id` against the LOGOC manifold (`compose`, `prove`,
 * `encode/decode`). Centralizing it guarantees `instanceof` works regardless of
 * which combinator surfaced the error — one class, one identity.
 */

export class UnknownSignClassError extends Error {
  readonly classId: number;
  constructor(classId: number) {
    super(`Unknown Peirce sign class id: ${classId}`);
    this.name = "UnknownSignClassError";
    this.classId = classId;
  }
}