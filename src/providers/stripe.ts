import { loadScript, PROVIDER_SCRIPTS } from '../core/script-loader';
import { ApertureAPI } from '../core/api';
import type { PaymentResult } from '../types';

declare global {
  interface Window {
    Stripe?: (key: string) => StripeInstance;
  }
}

interface StripeInstance {
  elements: () => StripeElements;
  confirmCardPayment: (
    clientSecret: string,
    data?: { payment_method?: { card: StripeCardElement } | string; return_url?: string }
  ) => Promise<{ error?: { message: string; code: string }; paymentIntent?: { id: string; status: string; payment_method: string } }>;
}

interface StripeElements {
  create: (type: string, options?: Record<string, unknown>) => StripeCardElement;
}

export interface StripeCardElement {
  mount: (el: string | HTMLElement) => void;
  unmount: () => void;
  destroy: () => void;
  on: (event: string, handler: (e: unknown) => void) => void;
}

export interface StripeHandle {
  stripe: StripeInstance;
  cardElement: StripeCardElement;
  clientSecret: string;
  orderId: string;
  confirmPayment: () => Promise<PaymentResult>;
}

export async function initStripe(
  payload: Record<string, unknown>,
  orderId: string,
  containerEl: string | HTMLElement,
  api: ApertureAPI,
): Promise<StripeHandle> {
  await loadScript(PROVIDER_SCRIPTS.STRIPE);

  if (!window.Stripe) throw new Error('Stripe SDK failed to load');

  const publishableKey = payload.publishableKey as string;
  const clientSecret = payload.clientSecret as string;

  if (!publishableKey) throw new Error('Missing Stripe publishable key');
  if (!clientSecret) throw new Error('Missing Stripe client secret');

  const stripe = window.Stripe(publishableKey);
  const elements = stripe.elements();
  const cardElement = elements.create('card', {
    style: {
      base: {
        fontSize: '16px',
        color: '#32325d',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        '::placeholder': { color: '#aab7c4' },
      },
    },
  });

  const container = typeof containerEl === 'string' ? document.querySelector(containerEl) : containerEl;
  if (!container) throw new Error(`Container not found: ${containerEl}`);
  cardElement.mount(container as HTMLElement);

  const confirmPayment = async (): Promise<PaymentResult> => {
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (error) {
      return { provider: 'STRIPE', orderId, status: 'FAILED', error: error.message, errorCode: error.code };
    }

    if (paymentIntent?.status === 'succeeded') {
      await api.confirmPayment(orderId, {
        paymentIntentId: paymentIntent.id,
        paymentMethodId: paymentIntent.payment_method,
      });
      return { provider: 'STRIPE', orderId, status: 'SUCCEEDED', providerReferenceId: paymentIntent.id };
    }

    if (paymentIntent?.status === 'requires_action') {
      return { provider: 'STRIPE', orderId, status: 'REQUIRES_ACTION', providerReferenceId: paymentIntent.id };
    }

    return { provider: 'STRIPE', orderId, status: 'PROCESSING', providerReferenceId: paymentIntent?.id };
  };

  return { stripe, cardElement, clientSecret, orderId, confirmPayment };
}
