const loaded: Record<string, Promise<void>> = {};

export function loadScript(url: string): Promise<void> {
  if (url in loaded) return loaded[url];

  loaded[url] = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load: ${url}`));
    document.head.appendChild(script);
  });

  return loaded[url];
}

export const PROVIDER_SCRIPTS = {
  STRIPE: 'https://js.stripe.com/v3/',
  RAZORPAY: 'https://checkout.razorpay.com/v1/checkout.js',
  PAYPAL: 'https://www.paypal.com/sdk/js',
  AUTHORIZE_NET: 'https://jstest.authorize.net/v1/Accept.js',
} as const;
