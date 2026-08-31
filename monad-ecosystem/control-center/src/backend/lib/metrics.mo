import Types "../types/metrics";
import Queue "mo:core/Queue";

module {
  public type Metrics = Types.Metrics;
  public type Controls = Types.Controls;
  public type Config = Types.Config;
  public type LogEntry = Types.LogEntry;
  public type PrimaryMode = Types.PrimaryMode;
  public type SecondaryMode = Types.SecondaryMode;

  // Maximum number of log entries kept in the circular buffer.
  let MAX_LOG : Nat = 8;

  /// Advance metrics by one tick using deterministic pseudo-random variation.
  /// seed drives +/-5% CPU and memory fluctuation, values clamped to [5, 95].
  public func tickMetrics(metrics : Metrics, seed : Nat) : Metrics {
    let cpuDelta  : Int = (seed % 11 : Nat).toInt() - 5; // -5..+5
    let memDelta  : Int = ((seed / 7) % 11 : Nat).toInt() - 5;
    let newCpu    : Nat = clampPercent(metrics.cpuLoad.toInt() + cpuDelta);
    let newMem    : Nat = clampPercent(metrics.memoryUsage.toInt() + memDelta);
    {
      cpuLoad     = newCpu;
      memoryUsage = newMem;
      uptime      = metrics.uptime + 2;   // each tick = 2 seconds
      timestamp   = metrics.timestamp;    // caller updates timestamp
    };
  };

  /// Clamp an Int to the [5, 95] Nat range.
  func clampPercent(v : Int) : Nat {
    if (v < 5)  { return 5 };
    if (v > 95) { return 95 };
    v.toNat();
  };

  /// Append a log entry, keeping the buffer capped at MAX_LOG entries.
  public func appendLog(
    log : Queue.Queue<LogEntry>,
    entry : LogEntry,
  ) {
    log.pushBack(entry);
    while (log.size() > MAX_LOG) {
      ignore log.popFront();
    };
  };

  /// Validate that a percentage threshold is in [1, 99].
  public func validatePercent(v : Nat) : Bool {
    v >= 1 and v <= 99;
  };

  /// Validate that a polling interval is in [100, 60000] ms.
  public func validateInterval(v : Nat) : Bool {
    v >= 100 and v <= 60000;
  };
};
