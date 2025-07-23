// Global type declarations for missing modules and Next.js compatibility

declare module 'VAR_MODULE_GLOBAL_ERROR' {
  const GlobalError: any;
  export default GlobalError;
}

declare module 'react-server-dom-webpack/server.edge' {
  export const createTemporaryReferenceSet: any;
  export const renderToReadableStream: any;
  export const decodeReply: any;
  export const decodeAction: any;
  export const decodeFormState: any;
}

declare module 'react-server-dom-webpack/static.edge' {
  export const unstable_prerender: any;
  export const prerender: any;
}

// Fix for HeadersIterator
declare global {
  interface HeadersIterator<T> extends Iterator<T> {}
}

// Fix for webpack types
declare module 'next/dist/compiled/webpack/webpack' {
  import webpack from 'webpack';
  export = webpack;
  export namespace webpack {
    export interface RuleSetUseItem {
      loader?: string;
      options?: any;
    }
  }
}

// Fix for fs module
declare module 'fs' {
  import * as fs from 'fs';
  export = fs;
}

// Import Razorpay types
import { RazorpayOptions, RazorpayInstance } from '@/types/razorpay';

// Extend Window interface for any global properties
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
    gtag?: any;
  }
}

export {};
