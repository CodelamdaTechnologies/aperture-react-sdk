import type { ApertureAPI } from './api';
import type { PaymentStatus } from '../types';

export interface ProviderReturnParams {
  orderId: string;
  status: PaymentStatus;
  reason?: string;
}

export type ProviderReturnResult =
  | { detected: false }
  | {
      detected: true;
      params: ProviderReturnParams;

      backendStatus?: PaymentStatus;

      backendCheckFailed?: boolean;
    };

export interface ConsumeProviderReturnOptions {
  api: ApertureAPI;

  stripUrl?: boolean;

  search?: string;

  rewriteUrl?: (cleanUrl: string) => void;
}

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

export function stripReturnParams(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.hash;
}
