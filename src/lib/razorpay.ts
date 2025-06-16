import crypto from "crypto";
import loadEnv from "@/lib/env-loader";

// Load environment variables
loadEnv();

// Subscription-related interfaces
export interface RazorpayPlan {
  id: string;
  entity: string;
  interval: number;
  period: "daily" | "weekly" | "monthly" | "yearly";
  item: {
    id: string;
    active: boolean;
    name: string;
    description?: string;
    amount: number;
    unit_amount: number;
    currency: string;
    type: string;
    unit?: string;
    tax_inclusive: boolean;
    hsn_code?: string;
    sac_code?: string;
    tax_rate?: number;
    tax_id?: string;
    tax_group_id?: string;
    created_at: number;
    updated_at: number;
  };
  notes?: Record<string, string>;
  created_at: number;
}

export interface RazorpaySubscription {
  id: string;
  entity: string;
  plan_id: string;
  customer_id: string;
  status: string;
  current_start: number;
  current_end: number;
  ended_at?: number;
  quantity: number;
  notes?: Record<string, string>;
  charge_at: number;
  start_at?: number;
  end_at?: number;
  auth_attempts: number;
  total_count: number;
  paid_count: number;
  customer_notify: boolean;
  created_at: number;
  expire_by?: number;
  short_url?: string;
}

export interface RazorpayCustomer {
  id: string;
  entity: string;
  name: string;
  email: string;
  contact?: string;
  gstin?: string;
  notes?: Record<string, string>;
  created_at: number;
}

// Razorpay API keys
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

// Validate configuration at startup
export function checkRazorpayConfig() {
  if (!razorpayKeyId || !razorpayKeySecret) {
    const errorMessage = "Razorpay configuration error: Missing API credentials. " +
      "Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  console.log("Razorpay configuration validated successfully");
}

/**
 * Create a new Razorpay order using fetch API
 * @param amount Amount in smallest currency unit (paise for INR)
 * @param currency Currency code (default: INR)
 * @param receipt Optional receipt ID
 * @param notes Optional notes for the order
 * @returns Razorpay order object
 */
export const createOrder = async (
  amount: number,
  currency: string = "INR",
  receipt?: string,
  notes?: Record<string, string>
) => {
  // Validate configuration on first use
  if (!razorpayKeyId || !razorpayKeySecret) {
    const errorMessage = "Razorpay configuration error: Missing API credentials. " +
      "Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.";
    console.error(errorMessage);
    console.error("Current RAZORPAY_KEY_ID:", razorpayKeyId ? "***" : "not set");
    console.error("Current RAZORPAY_KEY_SECRET:", razorpayKeySecret ? "***" : "not set");
    throw new Error(errorMessage);
  }

  // Check for dummy/placeholder credentials
  if (razorpayKeySecret === "thiIsADummyKeySecret123" ||
      razorpayKeySecret.includes("dummy") ||
      razorpayKeySecret.includes("placeholder")) {
    const errorMessage = "Razorpay configuration error: You are using dummy/placeholder credentials. " +
      "Please replace with your actual Razorpay API credentials from dashboard.razorpay.com";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  try {
    // Create Basic Auth credentials
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");

    // Prepare request body
    const requestBody = {
      amount: amount * 100, // Convert to paise (smallest currency unit)
      currency,
      receipt,
      notes,
    };

    // Make API request to Razorpay
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Razorpay API Error Details:", {
        status: response.status,
        statusText: response.statusText,
        errorData,
        keyId: razorpayKeyId,
        keySecretLength: razorpayKeySecret?.length
      });

      // Provide specific error messages for common issues
      let errorMessage = `Razorpay API error: ${errorData.error?.description || "Unknown error"}`;

      if (response.status === 401) {
        errorMessage += "\n\nThis is an authentication error. Please check:\n" +
          "1. Your RAZORPAY_KEY_ID is correct\n" +
          "2. Your RAZORPAY_KEY_SECRET is correct\n" +
          "3. You're not using dummy/placeholder credentials\n" +
          "4. Your credentials are from the correct environment (test/live)";
      }

      throw new Error(errorMessage);
    }

    const order = await response.json();
    return order;
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw error;
  }
};

/**
 * Verify Razorpay payment signature
 * @param orderId Razorpay order ID
 * @param paymentId Razorpay payment ID
 * @param signature Razorpay signature
 * @returns Boolean indicating if signature is valid
 */
export const verifyPaymentSignature = (
  orderId: string,
  paymentId: string,
  signature: string
) => {
  if (!razorpayKeySecret) {
    throw new Error("Razorpay is not configured");
  }

  try {
    // Generate the expected signature
    const generatedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    // Compare the generated signature with the received signature
    return generatedSignature === signature;
  } catch (error) {
    console.error("Error verifying Razorpay signature:", error);
    throw error;
  }
};

/**
 * Fetch payment details from Razorpay
 * @param paymentId Razorpay payment ID
 * @returns Payment details
 */
export const fetchPaymentDetails = async (paymentId: string) => {
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error("Razorpay is not configured");
  }

  try {
    // Create Basic Auth credentials
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString(
      "base64"
    );

    // Make API request to Razorpay
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${paymentId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Razorpay API error: ${errorData.error?.description || "Unknown error"}`
      );
    }

    const payment = await response.json();
    return payment;
  } catch (error) {
    console.error("Error fetching Razorpay payment:", error);
    throw error;
  }
};

/**
 * Capture a payment (convert authorized payment to captured)
 * @param paymentId Razorpay payment ID
 * @param amount Amount to capture (in paise)
 * @returns Captured payment details
 */
export const capturePayment = async (paymentId: string, amount: number) => {
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error("Razorpay is not configured");
  }

  try {
    // Create Basic Auth credentials
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString(
      "base64"
    );

    // Make API request to Razorpay
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${paymentId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: amount * 100 }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Razorpay API error: ${errorData.error?.description || "Unknown error"}`
      );
    }

    const payment = await response.json();
    return payment;
  } catch (error) {
    console.error("Error capturing Razorpay payment:", error);
    throw error;
  }
};

// ============ SUBSCRIPTION FUNCTIONS ============

/**
 * Create a Razorpay customer
 * @param customerData Customer details
 * @returns Razorpay customer object
 */
export const createCustomer = async (customerData: {
  name: string;
  email: string;
  contact?: string;
  notes?: Record<string, string>;
}): Promise<RazorpayCustomer> => {
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error("Razorpay is not configured");
  }

  try {
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/customers", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(customerData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Razorpay API error: ${errorData.error?.description || "Unknown error"}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating Razorpay customer:", error);
    throw error;
  }
};

/**
 * Create a subscription plan
 * @param planData Plan details
 * @returns Razorpay plan object
 */
export const createPlan = async (planData: {
  period: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  item: {
    name: string;
    amount: number;
    currency: string;
    description?: string;
  };
  notes?: Record<string, string>;
}): Promise<RazorpayPlan> => {
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error("Razorpay is not configured");
  }

  try {
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");

    console.log("Sending plan data to Razorpay:", planData);

    const response = await fetch("https://api.razorpay.com/v1/plans", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(planData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Razorpay plan creation error response:", errorData);
      throw new Error(
        `Razorpay API error: ${errorData.error?.description || errorData.error?.code || "Unknown error"}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating Razorpay plan:", error);
    throw error;
  }
};

/**
 * Create a subscription
 * @param subscriptionData Subscription details
 * @returns Razorpay subscription object
 */
export const createSubscription = async (subscriptionData: {
  plan_id: string;
  customer_id: string;
  quantity?: number;
  total_count?: number;
  end_at?: number;
  customer_notify?: boolean;
  start_at?: number;
  expire_by?: number;
  addons?: Array<{
    item: {
      name: string;
      amount: number;
      currency: string;
    };
  }>;
  notes?: Record<string, string>;
  notify_info?: {
    notify_phone?: string;
    notify_email?: string;
  };
}): Promise<RazorpaySubscription> => {
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error("Razorpay is not configured");
  }

  try {
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");

    // Filter out undefined values from subscription data
    const cleanedSubscriptionData = Object.fromEntries(
      Object.entries(subscriptionData).filter(([_, value]) => value !== undefined)
    );

    console.log("Sending subscription data to Razorpay:", cleanedSubscriptionData);

    const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cleanedSubscriptionData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Razorpay API error response:", errorData);
      throw new Error(
        `Razorpay API error: ${errorData.error?.description || errorData.error?.code || "Unknown error"}`
      );
    }

    const subscriptionResponse = await response.json();
    console.log("Razorpay subscription response:", {
      id: subscriptionResponse.id,
      status: subscriptionResponse.status,
      current_start: subscriptionResponse.current_start,
      current_end: subscriptionResponse.current_end,
      charge_at: subscriptionResponse.charge_at,
      start_at: subscriptionResponse.start_at,
      end_at: subscriptionResponse.end_at,
      created_at: subscriptionResponse.created_at
    });

    return subscriptionResponse;
  } catch (error) {
    console.error("Error creating Razorpay subscription:", error);
    throw error;
  }
};

/**
 * Fetch subscription details
 * @param subscriptionId Razorpay subscription ID
 * @returns Subscription details
 */
export const fetchSubscription = async (subscriptionId: string): Promise<RazorpaySubscription> => {
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error("Razorpay is not configured");
  }

  try {
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");

    const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Razorpay API error: ${errorData.error?.description || "Unknown error"}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching Razorpay subscription:", error);
    throw error;
  }
};

/**
 * Cancel a subscription
 * @param subscriptionId Razorpay subscription ID
 * @param cancelAtCycleEnd Whether to cancel at the end of current cycle
 * @returns Cancelled subscription details
 */
export const cancelSubscription = async (
  subscriptionId: string,
  cancelAtCycleEnd: boolean = false
): Promise<RazorpaySubscription> => {
  if (!razorpayKeyId || !razorpayKeySecret) {
    throw new Error("Razorpay is not configured");
  }

  try {
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");

    const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cancel_at_cycle_end: cancelAtCycleEnd
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Razorpay API error: ${errorData.error?.description || "Unknown error"}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error cancelling Razorpay subscription:", error);
    throw error;
  }
};

/**
 * Verify webhook signature
 * @param body Raw webhook body
 * @param signature Razorpay signature from header
 * @param secret Webhook secret
 * @returns Boolean indicating if signature is valid
 */
export const verifyWebhookSignature = (
  body: string,
  signature: string,
  secret: string
): boolean => {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    return expectedSignature === signature;
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
};

/**
 * Verify subscription payment signature
 * @param subscriptionId Razorpay subscription ID
 * @param paymentId Razorpay payment ID
 * @param signature Razorpay signature
 * @returns Boolean indicating if signature is valid
 */
export const verifySubscriptionSignature = (
  subscriptionId: string,
  paymentId: string,
  signature: string
): boolean => {
  if (!razorpayKeySecret) {
    throw new Error("Razorpay is not configured");
  }

  try {
    // Try both possible formats for subscription signature verification

    // Format 1: payment_id|subscription_id (most common for subscription authentication)
    const generatedSignature1 = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${paymentId}|${subscriptionId}`)
      .digest("hex");

    // Format 2: subscription_id|payment_id (alternative format)
    const generatedSignature2 = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${subscriptionId}|${paymentId}`)
      .digest("hex");

    const isValid1 = generatedSignature1 === signature;
    const isValid2 = generatedSignature2 === signature;

    // Log only if verification fails for debugging
    if (!isValid1 && !isValid2) {
      console.error("Subscription signature verification failed:", {
        paymentId,
        subscriptionId,
        receivedSignature: signature.substring(0, 10) + "...",
        format1Match: isValid1,
        format2Match: isValid2
      });
    }

    return isValid1 || isValid2;
  } catch (error) {
    console.error("Error verifying subscription signature:", error);
    return false;
  }
};
