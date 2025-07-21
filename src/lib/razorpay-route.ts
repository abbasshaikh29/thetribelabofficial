import crypto from 'crypto';

// Razorpay Route API Configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID!;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET!;
const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';

// Route API endpoints
const ROUTE_ENDPOINTS = {
  ACCOUNTS: '/accounts',
  TRANSFERS: '/transfers',
  SETTLEMENTS: '/settlements',
  WEBHOOKS: '/webhooks'
};

// Interface definitions for Route API
export interface IRouteAccountRequest {
  email: string;
  phone: string;
  type: 'route';
  reference_id: string;
  legal_business_name: string;
  business_type: 'individual' | 'partnership' | 'private_limited' | 'public_limited' | 'llp';
  contact_name: string;
  profile?: {
    category: string;
    subcategory: string;
    addresses?: {
      registered?: {
        street1: string;
        street2?: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
      };
    };
  };
  legal_info?: {
    pan: string;
    gst?: string;
  };
  brand?: {
    color?: string;
  };
  notes?: Record<string, string>;
}

export interface IRouteAccountResponse {
  id: string;
  entity: 'account';
  status: 'created' | 'activated' | 'suspended' | 'rejected';
  email: string;
  phone: string;
  type: 'route';
  reference_id: string;
  legal_business_name: string;
  business_type: string;
  contact_name: string;
  profile: any;
  legal_info: any;
  brand: any;
  notes: Record<string, string>;
  created_at: number;
}

export interface ITransferRequest {
  account: string; // Route account ID
  amount: number; // Amount in paise
  currency: 'INR';
  mode: 'IMPS' | 'NEFT' | 'RTGS' | 'UPI';
  purpose: 'refund' | 'cashback' | 'payout' | 'salary' | 'utility_bill' | 'vendor_bill';
  queue_if_low_balance?: boolean;
  reference_id?: string;
  narration?: string;
  notes?: Record<string, string>;
}

export interface ITransferResponse {
  id: string;
  entity: 'transfer';
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'cancelled' | 'reversed';
  source: string;
  recipient: string;
  amount: number;
  currency: string;
  mode: string;
  purpose: string;
  reference_id: string;
  narration: string;
  batch_id?: string;
  failure_reason?: string;
  created_at: number;
  processed_at?: number;
  notes: Record<string, string>;
}

class RazorpayRouteClient {
  private keyId: string;
  private keySecret: string;
  private baseUrl: string;

  constructor() {
    this.keyId = RAZORPAY_KEY_ID;
    this.keySecret = RAZORPAY_KEY_SECRET;
    this.baseUrl = RAZORPAY_BASE_URL;

    if (!this.keyId || !this.keySecret) {
      throw new Error('Razorpay credentials not found in environment variables');
    }
  }

  /**
   * Generate authorization header for Razorpay API
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Make HTTP request to Razorpay API
   */
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' = 'GET',
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          `Razorpay API Error: ${response.status} - ${responseData.error?.description || responseData.message || 'Unknown error'}`
        );
      }

      return responseData;
    } catch (error) {
      console.error('Razorpay Route API Error:', error);
      throw error;
    }
  }

  /**
   * Create a Route account for an admin
   */
  async createAccount(accountData: IRouteAccountRequest): Promise<IRouteAccountResponse> {
    return this.makeRequest<IRouteAccountResponse>(
      ROUTE_ENDPOINTS.ACCOUNTS,
      'POST',
      accountData
    );
  }

  /**
   * Get Route account details
   */
  async getAccount(accountId: string): Promise<IRouteAccountResponse> {
    return this.makeRequest<IRouteAccountResponse>(
      `${ROUTE_ENDPOINTS.ACCOUNTS}/${accountId}`
    );
  }

  /**
   * Update Route account
   */
  async updateAccount(
    accountId: string, 
    updateData: Partial<IRouteAccountRequest>
  ): Promise<IRouteAccountResponse> {
    return this.makeRequest<IRouteAccountResponse>(
      `${ROUTE_ENDPOINTS.ACCOUNTS}/${accountId}`,
      'PATCH',
      updateData
    );
  }

  /**
   * Create a transfer to Route account
   */
  async createTransfer(transferData: ITransferRequest): Promise<ITransferResponse> {
    return this.makeRequest<ITransferResponse>(
      ROUTE_ENDPOINTS.TRANSFERS,
      'POST',
      transferData
    );
  }

  /**
   * Get transfer details
   */
  async getTransfer(transferId: string): Promise<ITransferResponse> {
    return this.makeRequest<ITransferResponse>(
      `${ROUTE_ENDPOINTS.TRANSFERS}/${transferId}`
    );
  }

  /**
   * Get all transfers for an account
   */
  async getAccountTransfers(
    accountId: string,
    options?: {
      count?: number;
      skip?: number;
      from?: number;
      to?: number;
    }
  ): Promise<{ entity: string; count: number; items: ITransferResponse[] }> {
    const queryParams = new URLSearchParams();
    
    if (options?.count) queryParams.append('count', options.count.toString());
    if (options?.skip) queryParams.append('skip', options.skip.toString());
    if (options?.from) queryParams.append('from', options.from.toString());
    if (options?.to) queryParams.append('to', options.to.toString());

    const endpoint = `${ROUTE_ENDPOINTS.ACCOUNTS}/${accountId}/transfers${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

    return this.makeRequest(endpoint);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Calculate platform fee and net amount
   */
  calculateFeeBreakdown(
    grossAmount: number,
    platformFeeRate: number = 5.0
  ): {
    grossAmount: number;
    platformFeeAmount: number;
    processingFeeAmount: number;
    netAmount: number;
    platformFeeRate: number;
  } {
    // Platform fee calculation
    const platformFeeAmount = Math.round((grossAmount * platformFeeRate) / 100);
    
    // Razorpay processing fee: 2% + ₹2
    const processingFeeAmount = Math.round((grossAmount * 2) / 100) + 200;
    
    // Net amount for admin
    const netAmount = grossAmount - platformFeeAmount - processingFeeAmount;

    return {
      grossAmount,
      platformFeeAmount,
      processingFeeAmount,
      netAmount: Math.max(0, netAmount),
      platformFeeRate
    };
  }

  /**
   * Get optimal transfer mode based on amount
   */
  getOptimalTransferMode(amount: number): 'IMPS' | 'NEFT' | 'RTGS' {
    // RTGS for amounts >= ₹2,00,000 (20000000 paise)
    if (amount >= 20000000) return 'RTGS';

    // NEFT for amounts >= ₹50,000 (5000000 paise)
    if (amount >= 5000000) return 'NEFT';

    // IMPS for smaller amounts (faster)
    return 'IMPS';
  }

  /**
   * Create bulk transfers (batch processing)
   */
  async createBulkTransfers(transfers: ITransferRequest[]): Promise<ITransferResponse[]> {
    const results: ITransferResponse[] = [];

    // Process transfers in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < transfers.length; i += batchSize) {
      const batch = transfers.slice(i, i + batchSize);

      const batchPromises = batch.map(transfer =>
        this.createTransfer(transfer).catch(error => ({
          error: error.message,
          transfer
        }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => !('error' in result)) as ITransferResponse[]);

      // Add delay between batches to respect rate limits
      if (i + batchSize < transfers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

// Export singleton instance
export const razorpayRoute = new RazorpayRouteClient();

// Types are already exported above with their definitions
