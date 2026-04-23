import type { CreatePaymentResponse, ConfirmPaymentResponse, PaymentRequest } from '../types';

export class ApertureAPI {
  private apiBase: string;
  private merchantId: string;

  constructor(apiBase: string, merchantId: string) {
    this.apiBase = apiBase.replace(/\/+$/, '');
    this.merchantId = merchantId;
  }

  async createPayment(request: PaymentRequest): Promise<CreatePaymentResponse> {
    const resp = await fetch(`${this.apiBase}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mid': this.merchantId,
      },
      body: JSON.stringify({
        orderId: request.orderId,
        amount: request.amount,
        currency: request.currency,
        provider: request.provider,
        returnUrl: request.returnUrl || window.location.href,
        customer: request.customer,
        notes: request.notes,
      }),
    });
    return resp.json();
  }

  async confirmPayment(orderId: string, providerTokens: Record<string, string>): Promise<ConfirmPaymentResponse> {
    const resp = await fetch(`${this.apiBase}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mid': this.merchantId,
      },
      body: JSON.stringify({ orderId, providerTokens }),
    });
    return resp.json();
  }

  async checkStatus(orderId: string): Promise<CreatePaymentResponse> {
    const resp = await fetch(`${this.apiBase}?orderId=${encodeURIComponent(orderId)}`, {
      headers: { 'mid': this.merchantId },
    });
    return resp.json();
  }
}
