import { loadScript, PROVIDER_SCRIPTS } from '../core/script-loader';
import { ApertureAPI } from '../core/api';
import type { PaymentResult, PaymentRequest } from '../types';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: Record<string, string>;
  notes?: Record<string, string>;
  theme: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (resp: { error: { description: string; code: string } }) => void) => void;
}

export async function openRazorpay(
  payload: Record<string, unknown>,
  orderId: string,
  request: PaymentRequest,
  api: ApertureAPI,
  theme?: { primaryColor?: string; businessName?: string },
): Promise<PaymentResult> {
  await loadScript(PROVIDER_SCRIPTS.RAZORPAY);

  if (!window.Razorpay) throw new Error('Razorpay SDK failed to load');

  return new Promise<PaymentResult>((resolve, reject) => {
    const options: RazorpayOptions = {
      key: payload.keyId as string,
      amount: payload.amount as number,
      currency: (payload.currency as string) || request.currency,
      name: theme?.businessName || 'Payment',
      description: `Order ${orderId}`,
      order_id: payload.orderId as string,
      prefill: {},
      theme: { color: theme?.primaryColor || '#667eea' },
      handler: async (response) => {
        try {
          await api.confirmPayment(orderId, {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          });
          resolve({
            provider: 'RAZORPAY',
            orderId,
            status: 'SUCCEEDED',
            providerReferenceId: response.razorpay_payment_id,
          });
        } catch (err) {
          reject(err);
        }
      },
      modal: {
        ondismiss: () => {
          resolve({ provider: 'RAZORPAY', orderId, status: 'CANCELLED' });
        },
      },
    };

    if (request.customer?.name) options.prefill.name = request.customer.name;
    if (request.customer?.email) options.prefill.email = request.customer.email;
    if (request.customer?.contact) options.prefill.contact = request.customer.contact;
    if (request.notes) options.notes = request.notes;

    const RzpConstructor = window.Razorpay!;
    const rzp = new RzpConstructor(options);
    rzp.on('payment.failed', (resp) => {
      resolve({
        provider: 'RAZORPAY',
        orderId,
        status: 'FAILED',
        error: resp.error.description,
        errorCode: resp.error.code,
      });
    });
    rzp.open();
  });
}
