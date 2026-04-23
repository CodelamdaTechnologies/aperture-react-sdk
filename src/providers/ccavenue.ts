import type { PaymentResult } from '../types';

export function redirectCCAvenue(
  payload: Record<string, unknown>,
  orderId: string,
): PaymentResult {
  const form = document.createElement('form');
  form.method = (payload.formMethod as string) || 'POST';
  form.action = payload.paymentUrl as string;
  form.style.display = 'none';

  const fields: Record<string, string | undefined> = {
    encRequest: payload.encRequest as string,
    access_code: payload.accessCode as string,
  };

  Object.entries(fields).forEach(([name, value]) => {
    if (value) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
  });

  document.body.appendChild(form);
  form.submit();

  return { provider: 'CCAVENUE', orderId, status: 'REDIRECTING' };
}
