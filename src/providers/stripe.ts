import { loadScript, PROVIDER_SCRIPTS } from '../core/script-loader';
import { ApertureAPI } from '../core/api';
import type { PaymentResult } from '../types';

declare global {
  interface Window {
    Stripe?: (key: string) => StripeInstance;
  }
}

interface StripePaymentIntent {
  id: string;
  status: string;
  payment_method: string;
}

interface StripeError { message: string; code: string }

interface StripeInstance {
  elements: () => StripeElements;
  confirmCardPayment: (
    clientSecret: string,
    data?: { payment_method?: { card: StripeCardElement } | string; return_url?: string }
  ) => Promise<{ error?: StripeError; paymentIntent?: StripePaymentIntent }>;
  /**
   * Pops the 3DS challenge iframe for a PaymentIntent that came back with
   * status=requires_action. Resolves once the user completes (or fails)
   * the bank's authentication step. After this call the PaymentIntent's
   * status will be either succeeded, requires_payment_method (failed),
   * or processing.
   */
  handleCardAction: (
    clientSecret: string,
  ) => Promise<{ error?: StripeError; paymentIntent?: StripePaymentIntent }>;
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

  const finalizeSuccess = async (intent: StripePaymentIntent): Promise<PaymentResult> => {
    await api.confirmPayment(orderId, {
      paymentIntentId: intent.id,
      paymentMethodId: intent.payment_method,
    });
    return {
      provider: 'STRIPE',
      orderId,
      status: 'SUCCEEDED',
      providerReferenceId: intent.id,
    };
  };

  const confirmPayment = async (): Promise<PaymentResult> => {
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (error) {
      return { provider: 'STRIPE', orderId, status: 'FAILED', error: error.message, errorCode: error.code };
    }

    if (paymentIntent?.status === 'succeeded') {
      return finalizeSuccess(paymentIntent);
    }

    // 3DS — Stripe needs us to pop the bank's challenge iframe. handleCardAction
    // blocks on the user's interaction and resolves with the updated intent
    // status. We then finalise based on what the bank decided.
    if (paymentIntent?.status === 'requires_action') {
      const action = await stripe.handleCardAction(clientSecret);
      if (action.error) {
        return {
          provider: 'STRIPE',
          orderId,
          status: 'FAILED',
          error: action.error.message,
          errorCode: action.error.code,
        };
      }
      const next = action.paymentIntent;
      if (next?.status === 'succeeded') {
        return finalizeSuccess(next);
      }
      // Bank declined or requires another step we don't recognise. Surface
      // as FAILED so the caller can show a "try another card" prompt
      // instead of getting stuck on REQUIRES_ACTION forever.
      if (next?.status === 'requires_payment_method') {
        return {
          provider: 'STRIPE',
          orderId,
          status: 'FAILED',
          error: 'Bank declined the 3D Secure authentication. Please try another card.',
          providerReferenceId: next.id,
        };
      }
      return {
        provider: 'STRIPE',
        orderId,
        status: 'PROCESSING',
        providerReferenceId: next?.id,
      };
    }

    return { provider: 'STRIPE', orderId, status: 'PROCESSING', providerReferenceId: paymentIntent?.id };
  };

  return { stripe, cardElement, clientSecret, orderId, confirmPayment };
}
