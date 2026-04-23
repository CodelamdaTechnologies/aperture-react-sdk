import { useEffect, useRef } from 'react';
import { useAperture } from './useAperture';
import {
  consumeProviderReturn,
  type ProviderReturnResult,
  type ConsumeProviderReturnOptions,
} from '../core/return-handler';

export interface UseProviderReturnOptions
  extends Omit<ConsumeProviderReturnOptions, 'api'> {

  onReturn?: (result: Extract<ProviderReturnResult, { detected: true }>) => void;
}

export function useProviderReturn(options: UseProviderReturnOptions = {}): void {
  const { api } = useAperture();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    void consumeProviderReturn({ api, ...options }).then((result) => {
      if (!result.detected) return;
      options.onReturn?.(result);
    });

  }, []);
}
