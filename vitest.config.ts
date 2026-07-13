import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      '@sovereign/bus': resolve(__dirname, './monad-ecosystem/packages/sovereign-bus/src'),
      '@sovereign/types': resolve(__dirname, './monad-ecosystem/packages/sovereign-types/src'),
      '@sovereign/logoc': resolve(__dirname, './monad-ecosystem/packages/logoc/src'),
      '@sovereign/ttcl': resolve(__dirname, './monad-ecosystem/packages/ttcl/src'),
      '@sovereign/compiler': resolve(__dirname, './monad-ecosystem/packages/compiler/src'),
      '@sovereign/scheduler': resolve(__dirname, './monad-ecosystem/packages/scheduler/src'),
      '@sovereign/gnosis-training-data': resolve(__dirname, './monad-ecosystem/packages/gnosis-training-data/src'),
      '@sovereign/hepar-core': resolve(__dirname, './monad-ecosystem/packages/hepar-core/src'),
      '@sovereign/data-rail-core': resolve(__dirname, './monad-ecosystem/packages/data-rail-core/src'),
      '@sovereign/gnosis-evaluator-core': resolve(__dirname, './monad-ecosystem/packages/gnosis-evaluator-core/src'),
      '@sovereign/control-center-frontend': resolve(__dirname, './monad-ecosystem/control-center'),
      '@sovereign/risk-engine': resolve(__dirname, './monad-ecosystem/packages/risk-engine/src'),
      '@sovereign/hepar-defi-auditor': resolve(__dirname, './monad-ecosystem/packages/hepar-defi-auditor/src'),
    }
  }
});
