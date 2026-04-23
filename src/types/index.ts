export type PaymentProvider = 'STRIPE' | 'RAZORPAY' | 'CCAVENUE' | 'PAYPAL' | 'AUTHORIZE_NET';

export type PaymentStatus =
  | 'IDLE'
  | 'CREATING'
  | 'AWAITING_INPUT'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REDIRECTING'
  | 'REQUIRES_ACTION';

export interface ApertureConfig {
  merchantId: string;
  apiBase: string;
  theme?: {
    primaryColor?: string;
    businessName?: string;
    logo?: string;
  };
  onEvent?: (event: ApertureEvent) => void;
}

export interface ApertureEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  provider?: PaymentProvider;
  returnUrl?: string;
  customer?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
}

export interface PaymentResult {
  provider: PaymentProvider | string;
  orderId: string;
  status: PaymentStatus;
  providerReferenceId?: string;
  error?: string;
  errorCode?: string;
}

export interface CreatePaymentResponse {
  success: boolean;
  message?: string;
  data?: {
    orderId: string;
    status: string;
    provider: PaymentProvider | { name: string };
    providerClientPayload: Record<string, unknown>;
  };
  description?: string;
}

export interface ConfirmPaymentResponse {
  success: boolean;
  data?: {
    status: string;
    provider: PaymentProvider;
    providerReferenceId: string;
  };
}
