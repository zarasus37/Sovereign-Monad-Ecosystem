export interface OrganRuntimeConfig {
  cardia?: {
    deploymentMode?: 'blocked' | 'analysis_only' | 'bounded_ready' | 'active';
    reserveHealthy?: boolean;
  };
}

export interface OrganRuntimeSnapshot {
  cardia: {
    deploymentMode: 'blocked' | 'analysis_only' | 'bounded_ready' | 'active';
    reserveHealthy: boolean;
  };
}

export function buildRuntimeSnapshot(config: OrganRuntimeConfig): OrganRuntimeSnapshot {
  return {
    cardia: {
      deploymentMode: config.cardia?.deploymentMode ?? 'blocked',
      reserveHealthy: config.cardia?.reserveHealthy ?? false,
    },
  };
}
