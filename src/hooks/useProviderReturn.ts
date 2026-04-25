import { useEffect, useRef } from 'react';
import { useAperture } from './useAperture';
import {
  consumeProviderReturn,
  type ProviderReturnResult,
  type ConsumeProviderReturnOptions,
} from '../core/return-handler';

export interface UseProviderReturnOptions
  extends Omit<ConsumeProviderReturnOptions, 'api'> {
  /**
   * Called once if a provider-return is detected and consumed. Receives the
   * URL-derived params plus the backend-authoritative status.
   */
  onReturn?: (result: Extract<ProviderReturnResult, { detected: true }>) => void;
}

/**
 * Drop this at the top of any checkout page that may receive a redirect-style
 * provider's return trip (today: CCAvenue). On mount, checks for the
 * {@code orderId/status/reason} query params, asks the backend for
 * authoritative status, fires the callback, and strips the URL.
 *
 * Runs once per mount. Strict-Mode safe (the inner ref guards against
 * React 18's double-effect in development).
 *
 * Example:
 * <pre>
 *   useProviderReturn({
 *     onReturn: ({ params, backendStatus }) => {
 *       toast.info(`Payment ${backendStatus ?? params.status}`);
 *     },
 *   });
 * </pre>
 */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
