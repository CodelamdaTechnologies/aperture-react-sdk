import React, { createContext, useMemo } from 'react';
import { ApertureAPI } from '../core/api';
import type { ApertureConfig } from '../types';

export interface ApertureContextValue {
  config: ApertureConfig;
  api: ApertureAPI;
}

export const ApertureContext = createContext<ApertureContextValue | null>(null);

interface ApertureProviderProps {
  config: ApertureConfig;
  children: React.ReactNode;
}

export function ApertureProvider({ config, children }: ApertureProviderProps) {
  const value = useMemo<ApertureContextValue>(
    () => ({
      config,
      api: new ApertureAPI(config.apiBase, config.merchantId),
    }),
    [config],
  );

  return <ApertureContext.Provider value={value}>{children}</ApertureContext.Provider>;
}
