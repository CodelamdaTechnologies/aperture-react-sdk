import { loadScript, PROVIDER_SCRIPTS } from '../core/script-loader';
import { ApertureAPI } from '../core/api';
import type { PaymentResult } from '../types';

declare global {
  interface Window {
    Accept?: {
      dispatchData: (
        secureData: AcceptSecureData,
        callback: (response: AcceptResponse) => void,
      ) => void;
    };
  }
}

interface AcceptSecureData {
  authData: {
    clientKey: string;
    apiLoginID: string;
  };
  cardData: {
    cardNumber: string;
    month: string;
    year: string;
    cardCode: string;
  };
}

interface AcceptResponse {
  messages: {
    resultCode: 'Ok' | 'Error';
    message: Array<{ code: string; text: string }>;
  };
  opaqueData?: {
    dataDescriptor: string;
    dataValue: string;
  };
}

export interface AuthorizeNetHandle {
  orderId: string;
  submitPayment: (cardData: {
    cardNumber: string;
    month: string;
    year: string;
    cardCode: string;
  }) => Promise<PaymentResult>;
}

export async function initAuthorizeNet(
  payload: Record<string, unknown>,
  orderId: string,
  api: ApertureAPI,
): Promise<AuthorizeNetHandle> {
  const environment = (payload.environment as string) || 'sandbox';
  const scriptUrl = environment === 'production'
    ? 'https://js.authorize.net/v1/Accept.js'
    : PROVIDER_SCRIPTS.AUTHORIZE_NET;

  await loadScript(scriptUrl);

  if (!window.Accept) throw new Error('Authorize.Net Accept.js failed to load');

  const clientKey = payload.clientKey as string;

  const apiLoginId = (payload.apiLoginId ?? payload.apiLoginID) as string;

  if (!clientKey) throw new Error('Missing Authorize.Net client key');
  if (!apiLoginId) throw new Error('Missing Authorize.Net API login ID');

  const submitPayment = async (cardData: {
    cardNumber: string;
    month: string;
    year: string;
    cardCode: string;
  }): Promise<PaymentResult> => {
    return new Promise<PaymentResult>((resolve) => {
      const secureData: AcceptSecureData = {
        authData: { clientKey, apiLoginID: apiLoginId },
        cardData,
      };

      window.Accept!.dispatchData(secureData, async (response) => {
        if (response.messages.resultCode === 'Error') {
          const errorMsg = response.messages.message
            .map((m) => m.text)
            .join('; ');
          resolve({
            provider: 'AUTHORIZE_NET',
            orderId,
            status: 'FAILED',
            error: errorMsg,
            errorCode: response.messages.message[0]?.code,
          });
          return;
        }

        if (!response.opaqueData) {
          resolve({
            provider: 'AUTHORIZE_NET',
            orderId,
            status: 'FAILED',
            error: 'No payment nonce received',
          });
          return;
        }

        try {
          const confirmResult = await api.confirmPayment(orderId, {
            dataDescriptor: response.opaqueData.dataDescriptor,
            dataValue: response.opaqueData.dataValue,
          });

          if (confirmResult.success && confirmResult.data) {
            resolve({
              provider: 'AUTHORIZE_NET',
              orderId,
              status: confirmResult.data.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'PROCESSING',
              providerReferenceId: confirmResult.data.providerReferenceId,
            });
          } else {
            resolve({
              provider: 'AUTHORIZE_NET',
              orderId,
              status: 'FAILED',
              error: 'Payment confirmation failed',
            });
          }
        } catch (err) {
          resolve({
            provider: 'AUTHORIZE_NET',
            orderId,
            status: 'FAILED',
            error: err instanceof Error ? err.message : 'Confirmation failed',
          });
        }
      });
    });
  };

  return { orderId, submitPayment };
}
