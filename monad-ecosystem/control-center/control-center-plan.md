# Sovereign Monad Control Center — Implementation Plan

The Control Center is currently a high-fidelity functional prototype aligned with the "Sovereign Monad Ecosystem" operational state.

## Current Coverage
- **15-Layer Architecture**: A fully navigatable structure matching the ecosystem's doctrinal and physical layers.
- **Operational Agent Integration**: The backend now correctly references operational agents (`Risk Engine`, `Arb Bots`, `Dove Protocol`) rather than generic placeholders.
- **Signal & Skills Matrix**: Kafka topology and agent capabilities are mapped to market arbitrage and risk management domains.
- **Command & Control**: A functional UI for toggling "Armed" status and system modes (Active/Standby/Diagnostic).

## Gaps (To Be Addressed)
- [ ] **Live Telemetry Bridge**: Backend ingestion methods now exist; wire the Python agents and on-chain event watchers into `updateAgentStatus` / `pushKafkaSignal` and retire any remaining mock-only paths in production.
- [ ] **Organ Sub-Pages**: Build out the specific forensic ([Hepar](./src/frontend/src/pages/HepaPage.tsx)) and capital ([Cardia](./src/frontend/src/pages/CardiaPage.tsx)) interfaces.
- [ ] **Execution Loop**: Link the "Armed" toggle to the actual process management of the arbitrage bots.
- [ ] **Blockchain Monitoring**: Integrate `DoveCore.sol` event logs directly into the "Settlement Events" view.

## Immediate Next Steps
1. **Operationalize Hepar**: Replace the stub in `HepaPage.tsx` with a dashboard for forensic lead and behavioral monitoring.
2. **Producer Wiring**: Connect Python agents and blockchain/event sources to the new ingestion methods.
3. **Build & Verify**: Run `pnpm build` in the `control-center` directory to ensure production readiness.
4. **Environment Sync**: Map the `.env.phase1a` variables from the agent repo to the Control Center's configuration.
