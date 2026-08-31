/**
 * Operator allowlist helpers — shared by every state-mutating mixin.
 *
 * P0: every public shared mutator in `mixins/` reads `msg.caller`, rejects
 * the anonymous principal, and verifies the caller is in the operator
 * allowlist. These helpers are the single place to make that check.
 *
 * Phase 2 (deferred — canister is not deployed):
 * - main.mo currently seeds the allowlist as []. Deployment must populate
 *   it (typically with the canister's own controller principal, plus any
 *   named operator identities) before going live.
 * - A future `setOperators` admin function (itself gated by the same
 *   check) is the intended way to rotate the list at runtime.
 *
 * Until that lands, all state-mutating public functions are locked open
 * only to entries in the seeded list — i.e. no one, in a not-yet-deployed
 * canister. That is the correct fail-closed default.
 */
import Principal "mo:base/Principal";

module {
  /// Returns `?err` if `caller` is the anonymous principal (rejected),
  /// or `null` if it is acceptable. Use early in every mutator:
  ///   switch (Operators.checkCaller(msg.caller)) {
  ///     case (?err) return #err(err);
  ///     case null {};
  ///   };
  public func checkCaller(caller : Principal) : ?Text {
    if (Principal.isAnonymous(caller)) {
      ?"anonymous caller rejected";
    } else {
      null;
    };
  };

  /// Returns true if `caller` appears in `allowlist`. The allowlist is
  /// passed in from the actor (main.mo) so each mixin doesn't own its
  /// own copy. Comparison is by Principal equality.
  public func isOperator(caller : Principal, allowlist : [Principal]) : Bool {
    var found = false;
    for (p in allowlist.vals()) {
      if (p == caller) {
        found := true;
      };
    };
    found;
  };

  /// Convenience: returns the standard "not in operator allowlist" error.
  /// Kept here so the message is consistent across every mutator.
  public func notOperatorErr() : Text {
    "caller not in operator allowlist";
  };
};
