# @aperturetech/react-sdk

React SDK for Aperture Payment — unified payment integration. One SDK, all providers (Stripe, Razorpay, CCAvenue).

## Install

```bash
npm install @aperturetech/react-sdk
```

## Quick Start

### 1. Wrap your app with `<ApertureProvider>`

```tsx
import { ApertureProvider } from '@aperturetech/react-sdk';

function App() {
  return (
    <ApertureProvider config={{
      merchantId: 'YOUR_MERCHANT_MID',
      apiBase: 'https://api.yoursite.com/api/v1/payment',
    }}>
      <CheckoutPage />
    </ApertureProvider>
  );
}
```

### 2. Use `usePayment` hook in your checkout

```tsx
import { usePayment, CardElement } from '@aperturetech/react-sdk';

function CheckoutPage() {
  const { status, error, result, createPayment, confirmPayment } = usePayment('#aperture-card-element');

  const handlePay = async () => {
    await createPayment({
      orderId: 'ORD-' + Date.now(),
      amount: 500,
      currency: 'INR',
      provider: 'STRIPE', // or 'RAZORPAY', or omit for auto
      customer: { name: 'John', email: 'john@test.com' },
    });
    // For Stripe: status becomes 'AWAITING_INPUT', card form is mounted
    // For Razorpay: popup opens automatically, resolves when done
  };

  const handleConfirm = async () => {
    // Call this after user fills the Stripe card form
    const result = await confirmPayment();
    if (result.status === 'SUCCEEDED') {
      alert('Payment successful!');
    }
  };

  return (
    <div>
      <h2>Checkout</h2>
      <button onClick={handlePay} disabled={status !== 'IDLE'}>
        Pay ₹500
      </button>

      {/* Stripe card input mounts here */}
      {status === 'AWAITING_INPUT' && (
        <>
          <CardElement />
          <button onClick={handleConfirm}>Confirm Payment</button>
        </>
      )}

      {status === 'PROCESSING' && <p>Processing...</p>}
      {status === 'SUCCEEDED' && <p>Payment successful! Ref: {result?.providerReferenceId}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

## Provider Flows

### Stripe (Inline Card Form)

```tsx
function StripeCheckout() {
  const { status, error, createPayment, confirmPayment } = usePayment('#aperture-card-element');

  return (
    <div>
      <button onClick={() => createPayment({
        orderId: 'ORD-' + Date.now(),
        amount: 10,
        currency: 'USD',
        provider: 'STRIPE',
      })}>
        Pay $10
      </button>

      {status === 'AWAITING_INPUT' && (
        <>
          <CardElement id="aperture-card-element" />
          <button onClick={confirmPayment}>Confirm</button>
        </>
      )}

      {status === 'SUCCEEDED' && <p>Paid!</p>}
      {error && <p>{error}</p>}
    </div>
  );
}
```

### Razorpay (Popup)

```tsx
function RazorpayCheckout() {
  const { status, error, result, createPayment } = usePayment();

  const handlePay = async () => {
    // SDK opens Razorpay popup automatically
    const result = await createPayment({
      orderId: 'ORD-' + Date.now(),
      amount: 500,
      currency: 'INR',
      provider: 'RAZORPAY',
      customer: { name: 'Rohit', email: 'rohit@test.com', contact: '9876543210' },
    });
    // result.status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  };

  return (
    <div>
      <button onClick={handlePay} disabled={status === 'PROCESSING'}>Pay ₹500</button>
      {status === 'SUCCEEDED' && <p>Paid! Ref: {result?.providerReferenceId}</p>}
      {error && <p>{error}</p>}
    </div>
  );
}
```

### Auto Provider Selection

```tsx
// Don't specify provider — backend picks the best one
await createPayment({
  orderId: 'ORD-' + Date.now(),
  amount: 500,
  currency: 'INR',
  // no provider specified — backend auto-selects
});
```

## API Reference

### `<ApertureProvider config={...}>`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `config.merchantId` | `string` | Yes | Your merchant MID |
| `config.apiBase` | `string` | Yes | Payment API URL (e.g., `https://api.com/api/v1/payment`) |
| `config.theme.primaryColor` | `string` | No | Brand color for Razorpay popup |
| `config.theme.businessName` | `string` | No | Business name shown in checkout |
| `config.onEvent` | `(event) => void` | No | Event callback for tracking |

### `usePayment(stripeContainer?)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `stripeContainer` | `string \| HTMLElement` | CSS selector or element for Stripe card input |

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | `PaymentStatus` | Current state: `IDLE`, `CREATING`, `AWAITING_INPUT`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED` |
| `error` | `string \| null` | Error message if failed |
| `result` | `PaymentResult \| null` | Payment result with provider reference |
| `createPayment(request)` | `function` | Start payment flow |
| `confirmPayment()` | `function` | Confirm Stripe card payment |
| `checkStatus(orderId)` | `function` | Poll payment status |
| `reset()` | `function` | Reset to idle state |

### `<CardElement />`

Renders a styled container for the Stripe card input.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `id` | `string` | `aperture-card-element` | Element ID (match with usePayment selector) |
| `className` | `string` | - | Additional CSS classes |
| `style` | `CSSProperties` | - | Inline styles |

## Events

```tsx
<ApertureProvider config={{
  ...config,
  onEvent: (event) => {
    console.log(event.type, event.data);
    // event.type: 'payment.initiated' | 'payment.created' | 'stripe.mounted'
    //           | 'payment.submitting' | 'payment.succeeded' | 'payment.failed'
    //           | 'payment.cancelled' | 'payment.error'
  }
}}>
```

## Architecture

```
Your React App
    │
    └── <ApertureProvider config={...}>
            │
            └── usePayment('#card-element')
                    │
                    ├── createPayment({...})
                    │       │
                    │       ├── POST /api/v1/payment/create  (your backend)
                    │       │       └── Returns { provider, clientPayload }
                    │       │
                    │       ├── provider === 'STRIPE'
                    │       │       └── Loads Stripe.js → mounts CardElement
                    │       │           └── status = 'AWAITING_INPUT'
                    │       │
                    │       ├── provider === 'RAZORPAY'
                    │       │       └── Loads Razorpay.js → opens popup
                    │       │           └── status = 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
                    │       │
                    │       └── provider === 'CCAVENUE'
                    │               └── Creates form → auto-redirects
                    │                   └── status = 'REDIRECTING'
                    │
                    └── confirmPayment()  (Stripe only)
                            │
                            ├── stripe.confirmCardPayment()
                            └── POST /api/v1/payment/confirm  (your backend)
```
