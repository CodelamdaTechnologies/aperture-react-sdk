// Components
export { ApertureProvider } from './components/ApertureProvider';
export { CardElement } from './components/CardElement';

// Hooks
export { useAperture } from './hooks/useAperture';
export { usePayment } from './hooks/usePayment';
export { useProviderReturn } from './hooks/useProviderReturn';

// Provider-return helper (non-React callers can use this directly)
export {
  consumeProviderReturn,
  stripReturnParams,
} from './core/return-handler';
export type {
  ProviderReturnParams,
  ProviderReturnResult,
  ConsumeProviderReturnOptions,
} from './core/return-handler';
export type { UseProviderReturnOptions } from './hooks/useProviderReturn';

// Types
export type {
  ApertureConfig,
  ApertureEvent,
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
  PaymentProvider,
} from './types';
