import type { ApertureAPI } from './api';
import type { PaymentStatus } from '../types';

/**
 * Provider-return query parameters set by the backend after a redirect-style
 * provider (today: CCAvenue) finishes processing and 302s the browser back
 * to the merchant's frontend.
 *
 * The backend always emits at least {@code orderId} and {@code status};
 * {@code reason} is only present on failures (callback_rejected:..., genuine
 * provider decline message, internal_error).
 */
export interface ProviderReturnParams {
  orderId: string;
  status: PaymentStatus;
  reason?: string;
}

/**
 * Outcome of {@link consumeProviderReturn}: either no return was detected,
 * or one was and the backend's authoritative status has been fetched and
 * is included alongside the URL-derived params.
 */
export type ProviderReturnResult =
  | { detected: false }
  | {
      detected: true;
      params: ProviderReturnParams;
      /** Backend status from /checkStatus, may differ from URL status if the
       *  backend reconciled in the meantime. Omitted if the call failed. */
      backendStatus?: PaymentStatus;
      /** True if checkStatus threw — caller can decide whether to surface it. */
      backendCheckFailed?: boolean;
    };

export interface ConsumeProviderReturnOptions {
  api: ApertureAPI;
  /**
   * Whether to clean the query string off the URL after consuming. Default
   * true — prevents a refresh from re-firing the post-payment side effects.
   */
  stripUrl?: boolean;
  /**
   * Override how params are read. Defaults to {@code window.location.search}.
   * Useful for SSR or test harnesses.
   */
  search?: string;
  /**
   * Override how the URL is rewritten. Defaults to using
   * {@code window.history.replaceState}. No-op in non-browser environments.
   */
  rewriteUrl?: (cleanUrl: string) => void;
}

/**
 * Inspects the current URL for provider-return query params. If present,
 * fetches authoritative status from the backend and returns both. If the
 * params aren't there, returns {@code { detected: false }} immediately.
 *
 * Idempotent — calling it after the URL has been stripped returns
 * {@code { detected: false }}.
 */
export async function consumeProviderReturn(
  options: ConsumeProviderReturnOptions,
): Promise<ProviderReturnResult> {
  const { api, stripUrl = true, search, rewriteUrl } = options;

  const rawSearch = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!rawSearch) return { detected: false };

  const params = new URLSearchParams(rawSearch);
  const orderId = params.get('orderId');
  const status = params.get('status') as PaymentStatus | null;
  if (!orderId || !status) return { detected: false };

  const reason = params.get('reason') ?? undefined;
  const result: Extract<ProviderReturnResult, { detected: true }> = {
    detected: true,
    params: { orderId, status, reason },
  };

  try {
    const resp = await api.checkStatus(orderId);
    if (resp.success && resp.data) {
      result.backendStatus = resp.data.status as PaymentStatus;
    }
  } catch (e) {
    result.backendCheckFailed = true;
  }

  if (stripUrl) {
    if (rewriteUrl) {
      rewriteUrl(stripReturnParams());
    } else if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, '', stripReturnParams());
    }
  }

  return result;
}

/**
 * Returns the current pathname + hash, leaving the host in place — used to
 * rewrite the URL after we've consumed the return params so a refresh
 * doesn't replay the post-payment flow. Exposed so callers can compute it
 * without window if needed.
 */
export function stripReturnParams(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.hash;
}
