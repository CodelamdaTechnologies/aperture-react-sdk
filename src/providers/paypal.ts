import { loadScript, PROVIDER_SCRIPTS } from '../core/script-loader';
import { ApertureAPI } from '../core/api';
import type { PaymentResult, PaymentRequest } from '../types';

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

interface PayPalNamespace {
  Buttons: (options: PayPalButtonOptions) => PayPalButtonInstance;
}

interface PayPalButtonOptions {
  style?: Record<string, string>;
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string; payerID: string }) => Promise<void>;
  onCancel: () => void;
  onError: (err: Error) => void;
}

interface PayPalButtonInstance {
  render: (container: string | HTMLElement) => Promise<void>;
  close: () => void;
}

export async function openPayPal(
  payload: Record<string, unknown>,
  orderId: string,
  request: PaymentRequest,
  api: ApertureAPI,
  containerEl?: string | HTMLElement,
): Promise<PaymentResult> {
  const clientId = payload.clientId as string;
  if (!clientId) throw new Error('Missing PayPal client ID from backend');

  // Load PayPal SDK with merchant's client ID
  await loadScript(`${PROVIDER_SCRIPTS.PAYPAL}?client-id=${clientId}&currency=${request.currency || 'USD'}`);

  if (!window.paypal) throw new Error('PayPal SDK failed to load');

  const paypalOrderId = payload.paypalOrderId as string;
  if (!paypalOrderId) throw new Error('Missing PayPal order ID from backend');

  return new Promise<PaymentResult>((resolve) => {
    const container = containerEl || document.createElement('div');

    // If we created a temporary container, append it to body
    if (!containerEl) {
      const div = container as HTMLDivElement;
      div.id = 'aperture-paypal-container';
      div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;background:white;padding:24px;border-radius:12px;box-shadow:0 25px 50px rgba(0,0,0,0.25);min-width:360px;';

      // Add overlay
      const overlay = document.createElement('div');
      overlay.id = 'aperture-paypal-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;';
      overlay.onclick = () => {
        cleanup();
        resolve({ provider: 'PAYPAL', orderId, status: 'CANCELLED' });
      };
      document.body.appendChild(overlay);
      document.body.appendChild(div);
    }

    function cleanup() {
      const overlay = document.getElementById('aperture-paypal-overlay');
      const div = document.getElementById('aperture-paypal-container');
      overlay?.remove();
      if (!containerEl) div?.remove();
    }

    window.paypal!.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },

      createOrder: async () => paypalOrderId,

      onApprove: async (data) => {
        try {
          await api.confirmPayment(orderId, {
            paypalOrderId: data.orderID,
            payerID: data.payerID,
          });
          cleanup();
          resolve({
            provider: 'PAYPAL',
            orderId,
            status: 'SUCCEEDED',
            providerReferenceId: data.orderID,
          });
        } catch (err) {
          cleanup();
          resolve({
            provider: 'PAYPAL',
            orderId,
            status: 'FAILED',
            error: err instanceof Error ? err.message : 'Payment confirmation failed',
          });
        }
      },

      onCancel: () => {
        cleanup();
        resolve({ provider: 'PAYPAL', orderId, status: 'CANCELLED' });
      },

      onError: (err) => {
        cleanup();
        resolve({
          provider: 'PAYPAL',
          orderId,
          status: 'FAILED',
          error: err.message || 'PayPal error',
        });
      },
    }).render(container as HTMLElement);
  });
}
