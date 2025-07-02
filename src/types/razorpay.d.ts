export interface RazorpayPaymentResponse {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature?: string;
}

export interface RazorpayOptions {
  key: string | undefined;
  amount?: number;
  currency?: string;
  name?: string;
  description?: string;
  image?: string;
  order_id?: string;
  subscription_id?: string;
  handler?: (response: RazorpayPaymentResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

export interface RazorpayInstance {
  open(): void;
  close(): void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export {}; 