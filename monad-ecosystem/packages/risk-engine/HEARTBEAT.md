# HEARTBEAT.md — Periodic Self-Check

## On Every Heartbeat (15m)

### 1. System Pulse
- Confirm gateway is live, Telegram is polling, no error spikes in logs.
- Check disk space — alert if any drive < 5GB free.
- Check memory usage — alert if system RAM > 90%.

### 2. MEV Engine Status
- Run: `docker ps --format "table {{.Names}}\t{{.Status}}" --filter "label=com.docker.compose.project=monad-mev"` (or equivalent in the monad-mev dir).
- Expected: all 15 containers running (kafka, zookeeper, eth-market-agent, monad-market-agent, eth-arb-bot, monad-arb-bot, opportunity-constructor, risk-engine, signal-combiner, bridge-exec-bot, portfolio-manager, model-feedback-logger, monitoring, grafana, prometheus).
- If any container exited/crashed: capture last 50 lines of its logs, write to today's memory file, and alert on Telegram.
- If eth-market-agent stops publishing prices for > 5 min: investigate and alert.

### 3. Memory Hygiene
- Ensure `memory/YYYY-MM-DD.md` exists for today. If not, create it.
- If today's memory file is over 500 lines, consider summarizing older entries.
- Auto-capture any significant events to today's file (service restarts, errors fixed, config changes).

### 4. Proactive Alerts (Telegram)
- **Critical** (send immediately): Container crash, service down, gateway failure, disk full.
- **Warning** (batch per heartbeat): High memory, Kuru errors spiking, unusual log patterns.
- **Silent** (log only): All systems nominal, routine checks passed.

### 5. Self-Assessment
- Am I using my reasoning model for complex tasks and fast model for quick lookups? Optimize model selection.
- Are there pending tasks from previous sessions I should resume? Check memory.
- Did my last tool execution succeed? If not, try an alternative approach.

## Daily Tasks (Once per Day, ~08:00 CDT)

1. **Daily summary** — Write a brief summary of yesterday's events to MEMORY.md.
2. **Container health report** — Full docker stats snapshot, write to memory.
3. **MEV engine logs review** — Scan for recurring errors, new patterns, or opportunities.
4. **Prune old daily memory files** — Archive files older than 30 days.

## What NOT to Do on Heartbeat

- Don't restart services without being asked (log the issue instead). Exception: if a container has been down > 30 min and a restart was previously authorized for that container.
- Don't send routine "all good" messages — only alert on problems.
- Don't burn tokens on full spec re-reads; just check container status and logs.
- Don't spam Telegram with repeated alerts for the same issue — deduplicate.
