# boundary-stress-monitor

`boundary-stress-monitor` is the local analysis-mode `BoundaryStressMonitor v1` scaffold.

It models:

- sheath pressure
- turbulence level
- escalation tier
- pause/review guidance

It is driven from verified local runtime posture. It does not claim live contract-observer state yet.

## Commands

```bash
cmd /c npm install
cmd /c npm run build
cmd /c npm test
cmd /c npm start
```

## Runtime truth

This package is local and analysis-only.

It does not:

- consume live chain events
- trigger governance onchain
- replace future Dove or contract-observer enforcement
