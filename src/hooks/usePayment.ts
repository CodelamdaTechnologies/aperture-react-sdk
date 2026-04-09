import { useState, useCallback, useRef } from 'react';
import { useAperture } from './useAperture';
import { initStripe } from '../providers/stripe';
import { openRazorpay } from '../providers/razorpay';
import { redirectCCAvenue } from '../providers/ccavenue';
import { openPayPal } from '../providers/paypal';
import { initAuthorizeNet } from '../providers/authorize-net';
import type { PaymentRequest, PaymentResult, PaymentStatus, PaymentProvider } from '../types';
import type { StripeHandle } from '../providers/stripe';
import type { AuthorizeNetHandle } from '../providers/authorize-net';

interface UsePaymentReturn {
  status: PaymentStatus;
  error: string | null;
  result: PaymentResult | null;
  /** Start a payment. For Stripe with container, mounts card input and waits for confirmPayment(). */
  createPayment: (request: PaymentRequest) => Promise<PaymentResult | void>;
  /** Confirm Stripe card payment after user fills the card form. */
  confirmPayment: () => Promise<PaymentResult>;
  /** Check current payment status from backend. */
  checkStatus: (orderId: string) => Promise<void>;
  /** Reset state back to idle. */
  reset: () => void;
}

export function usePayment(stripeContainer?: string | HTMLElement): UsePaymentReturn {
  const { api, config } = useAperture();
  const [status, setStatus] = useState<PaymentStatus>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const stripeHandleRef = useRef<StripeHandle | null>(null);
  const authNetHandleRef = useRef<AuthorizeNetHandle | null>(null);

  const emit = useCallback(
    (type: string, data: Record<string, unknown> = {}) => {
      config.onEvent?.({ type, data });
    },
    [config],
  );

  const createPayment = useCallback(
    async (request: PaymentRequest): Promise<PaymentResult | void> => {
      setStatus('CREATING');
      setError(null);
      setResult(null);
      emit('payment.initiated', { orderId: request.orderId });

      try {
        const response = await api.createPayment(request);

        if (!response.success || !response.data) {
          throw new Error(response.description || response.message || 'Payment creation failed');
        }

        const data = response.data;
        const providerRaw = data.provider;
        const provider: string =
          typeof providerRaw === 'object' && providerRaw !== null
            ? (providerRaw as { name: string }).name
            : (providerRaw as string);
        const providerUpper = (provider || '').toUpperCase() as PaymentProvider;
        const payload = data.providerClientPayload || {};

        emit('payment.created', { orderId: data.orderId, provider: providerUpper });

        // Route to the correct provider handler
        switch (providerUpper) {
          case 'STRIPE': {
            if (stripeContainer) {
              // Inline mode — mount card element, wait for confirmPayment()
              setStatus('AWAITING_INPUT');
              const handle = await initStripe(payload, data.orderId, stripeContainer, api);
              stripeHandleRef.current = handle;
              emit('stripe.mounted', { orderId: data.orderId });
              return; // User will call confirmPayment() later
            }
            // No container — shouldn't happen in React, but fallback
            throw new Error('Stripe requires a container element. Pass stripeContainer to usePayment().');
          }

          case 'RAZORPAY': {
            setStatus('PROCESSING');
            const rzpResult = await openRazorpay(payload, data.orderId, request, api, config.theme);
            setResult(rzpResult);
            setStatus(rzpResult.status);
            if (rzpResult.status === 'FAILED') setError(rzpResult.error || 'Payment failed');
            emit(`payment.${rzpResult.status.toLowerCase()}`, rzpResult as unknown as Record<string, unknown>);
            return rzpResult;
          }

          case 'CCAVENUE': {
            setStatus('REDIRECTING');
            const ccResult = redirectCCAvenue(payload, data.orderId);
            setResult(ccResult);
            return ccResult;
          }

          case 'PAYPAL': {
            setStatus('PROCESSING');
            const ppResult = await openPayPal(payload, data.orderId, request, api);
            setResult(ppResult);
            setStatus(ppResult.status);
            if (ppResult.status === 'FAILED') setError(ppResult.error || 'Payment failed');
            emit(`payment.${ppResult.status.toLowerCase()}`, ppResult as unknown as Record<string, unknown>);
            return ppResult;
          }

          case 'AUTHORIZE_NET': {
            setStatus('AWAITING_INPUT');
            const handle = await initAuthorizeNet(payload, data.orderId, api);
            authNetHandleRef.current = handle;
            emit('authorizenet.ready', { orderId: data.orderId });
            return; // User will call confirmPayment() with card data
          }

          default: {
            const genericResult: PaymentResult = {
              provider: providerUpper,
              orderId: data.orderId,
              status: 'PROCESSING',
            };
            setResult(genericResult);
            setStatus('PROCESSING');
            return genericResult;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Payment failed';
        setError(msg);
        setStatus('FAILED');
        emit('payment.error', { error: msg });
        throw err;
      }
    },
    [api, config.theme, emit, stripeContainer],
  );

  const confirmPayment = useCallback(async (cardData?: {
    cardNumber: string;
    month: string;
    year: string;
    cardCode: string;
  }): Promise<PaymentResult> => {
    // Authorize.Net confirmation with card data
    if (authNetHandleRef.current && cardData) {
      setStatus('PROCESSING');
      setError(null);
      emit('payment.submitting', { provider: 'AUTHORIZE_NET' });

      try {
        const payResult = await authNetHandleRef.current.submitPayment(cardData);
        setResult(payResult);
        setStatus(payResult.status);
        if (payResult.status === 'FAILED') setError(payResult.error || 'Payment failed');
        emit(`payment.${payResult.status.toLowerCase()}`, payResult as unknown as Record<string, unknown>);
        return payResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Confirmation failed';
        setError(msg);
        setStatus('FAILED');
        throw err;
      }
    }

    // Stripe confirmation
    const handle = stripeHandleRef.current;
    if (!handle) throw new Error('No payment to confirm. Call createPayment() first.');

    setStatus('PROCESSING');
    setError(null);
    emit('payment.submitting', { provider: 'STRIPE' });

    try {
      const payResult = await handle.confirmPayment();
      setResult(payResult);
      setStatus(payResult.status);
      if (payResult.status === 'FAILED') setError(payResult.error || 'Payment failed');
      emit(`payment.${payResult.status.toLowerCase()}`, payResult as unknown as Record<string, unknown>);
      return payResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Confirmation failed';
      setError(msg);
      setStatus('FAILED');
      throw err;
    }
  }, [emit]);

  const checkStatus = useCallback(
    async (orderId: string) => {
      const resp = await api.checkStatus(orderId);
      if (resp.success && resp.data) {
        setStatus(resp.data.status as PaymentStatus);
      }
    },
    [api],
  );

  const reset = useCallback(() => {
    stripeHandleRef.current?.cardElement.destroy();
    stripeHandleRef.current = null;
    authNetHandleRef.current = null;
    setStatus('IDLE');
    setError(null);
    setResult(null);
  }, []);

  return { status, error, result, createPayment, confirmPayment, checkStatus, reset };
}
