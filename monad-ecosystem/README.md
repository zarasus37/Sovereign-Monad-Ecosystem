# Monad Ecosystem

## Purpose

Monad Ecosystem is the agentic, economic, and control pillar of the Sovereign Monad ecosystem. It holds the agent packages, control center, contracts, scripts, and legacy implementation history for the system's operational layer.

## Contents

- `packages/` - active TypeScript package surfaces
- `control-center/` - operator console and frontend/backend integration
- `agents/` - agent workspace surfaces and live work artifacts
- `contracts/` - contract code and related implementation material
- `scripts/` - ecosystem orchestration and maintenance scripts
- `tests/` - workspace-level tests
- `legacy/` - archived prior implementations and historical snapshots

## Run

From the repository root:

```powershell
pnpm install
pnpm check:layout
pnpm test
pnpm lint
pnpm build
```

For the control center specifically:

```powershell
pnpm --dir monad-ecosystem\control-center build
```

For a single package, run the package's own script from its folder or with `pnpm --dir <path> <script>`.

## Do Not Put Here

- TTC philosophical source material
- Gnostic Engine Python runtime code
- generated archive exports
- one-off sandboxes or disposable experiments
- root-level docs that belong in `docs/`

