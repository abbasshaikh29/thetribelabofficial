# Migration Guide: From One-Time Payments to Unified Payment System

## Overview

This guide helps you migrate from your existing one-time payment system to the new unified system that supports both one-time payments and subscriptions.

## What Changed

### ✅ **Preserved (Still Works)**
- Your existing `RazorpayCheckout` component
- All existing API endpoints (`/api/payments/*`)
- Database models (enhanced, not replaced)
- Payment verification logic
- Transaction tracking

### 🆕 **New Components Added**
- `UnifiedPaymentCheckout` - Handles both payment types
- `PlanSelector` - Complete plan selection UI
- `SubscriptionCheckout` - Subscription-specific checkout
- `SubscriptionDashboard` - Subscription management

### 🔄 **Enhanced Components**
- `RazorpayCheckout` - Now supports subscription detection
- `PaymentPlan` model - Added subscription fields
- User model - Added subscription tracking fields

## Migration Steps

### Step 1: Update Environment Variables

Add these new environment variables to your `.env` file:

```env
# Existing (keep these)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_public_key

# New for subscriptions
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
CRON_SECRET=your_cron_secret_for_maintenance
```

### Step 2: Database Migration

Your existing data is preserved. New fields are added with default values:

```javascript
// Run this in MongoDB to add new fields to existing plans
db.paymentplans.updateMany(
  {},
  {
    $set: {
      isSubscription: false,
      maxMembers: null,
      maxCommunities: null,
      storageLimit: null
    }
  }
);

// Add indexes for better performance
db.subscriptions.createIndex({ "userId": 1, "status": 1 });
db.subscriptions.createIndex({ "chargeAt": 1, "status": 1 });
```

### Step 3: Component Migration Options

#### Option A: Keep Existing Components (Recommended)
Your existing components continue to work. Just add new subscription components where needed:

```tsx
// Existing one-time payment (still works)
import RazorpayCheckout from "@/components/payments/RazorpayCheckout";

// New unified component (handles both)
import UnifiedPaymentCheckout from "@/components/payments/UnifiedPaymentCheckout";

// New plan selector (complete solution)
import PlanSelector from "@/components/payments/PlanSelector";
```

#### Option B: Replace with Unified Components
Replace your existing payment components gradually:

```tsx
// Before
<RazorpayCheckout
  amount={999}
  paymentType="platform"
  buttonText="Pay Now"
/>

// After
<UnifiedPaymentCheckout
  plan={{
    _id: "plan_id",
    name: "Premium Plan",
    amount: 999,
    currency: "INR",
    interval: "one_time",
    type: "one_time",
    planType: "platform",
    features: ["Feature 1", "Feature 2"]
  }}
  buttonText="Pay Now"
/>
```

### Step 4: Plan Creation Migration

#### Create Subscription Plans
```tsx
// Create a subscription plan
const subscriptionPlan = {
  name: "Premium Monthly",
  description: "All premium features",
  amount: 999,
  currency: "INR",
  interval: "monthly",
  planType: "platform",
  isSubscription: true,
  features: [
    "Unlimited communities",
    "Advanced analytics",
    "Priority support"
  ]
};

fetch("/api/plans", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(subscriptionPlan)
});
```

#### Convert Existing Plans
```tsx
// Convert existing one-time plan to subscription
const convertToSubscription = async (planId: string) => {
  await fetch("/api/plans", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planId,
      type: "one_time", // existing type
      isSubscription: true,
      interval: "monthly",
      razorpayPlanId: "rzp_plan_xxx" // create in Razorpay first
    })
  });
};
```

### Step 5: Webhook Setup

1. **Add Webhook Endpoint in Razorpay Dashboard:**
   ```
   URL: https://yourdomain.com/api/webhooks/razorpay
   Secret: your_webhook_secret
   Events: subscription.charged, subscription.failed, subscription.cancelled, etc.
   ```

2. **Test Webhook Locally:**
   ```bash
   # Use ngrok for local testing
   ngrok http 3000
   # Use the HTTPS URL for webhook endpoint
   ```

### Step 6: Cron Job Setup

Set up the maintenance cron job:

```bash
# Add to your cron jobs or use a service like Vercel Cron
# Run every hour
0 * * * * curl -H "Authorization: Bearer your_cron_secret" https://yourdomain.com/api/cron/subscription-maintenance
```

## Usage Examples

### Basic Plan Selection
```tsx
import PlanSelector from "@/components/payments/PlanSelector";

function PricingPage() {
  return (
    <PlanSelector
      planType="platform"
      onSuccess={(data) => {
        console.log("Payment successful:", data);
        // Handle success
      }}
      onError={(error) => {
        console.error("Payment error:", error);
        // Handle error
      }}
    />
  );
}
```

### Subscription Management
```tsx
import SubscriptionDashboard from "@/components/subscriptions/SubscriptionDashboard";

function UserDashboard() {
  return (
    <div>
      <h1>My Subscriptions</h1>
      <SubscriptionDashboard />
    </div>
  );
}
```

### Mixed Payment Types
```tsx
function CommunityPricing({ communityId }: { communityId: string }) {
  return (
    <div>
      <h2>Choose Your Plan</h2>
      <PlanSelector
        planType="community"
        communityId={communityId}
        onSuccess={(data) => {
          if (data.type === "subscription") {
            // Handle subscription success
            router.push("/dashboard?tab=subscriptions");
          } else {
            // Handle one-time payment success
            router.push(`/community/${communityId}`);
          }
        }}
      />
    </div>
  );
}
```

## Testing

### Test One-Time Payments
```tsx
// Your existing test cases should still work
const testOneTimePayment = {
  amount: 999,
  currency: "INR",
  paymentType: "platform"
};
```

### Test Subscriptions
```tsx
// Test subscription creation
const testSubscription = {
  planId: "subscription_plan_id",
  customerNotify: true
};

// Use Razorpay test cards
// Success: 4111 1111 1111 1111
// Failure: 4000 0000 0000 0002
```

## Rollback Plan

If you need to rollback:

1. **Keep using existing components:**
   ```tsx
   // Continue using RazorpayCheckout for one-time payments
   import RazorpayCheckout from "@/components/payments/RazorpayCheckout";
   ```

2. **Disable subscription features:**
   ```tsx
   // Filter out subscription plans
   const oneTimePlans = plans.filter(plan => !plan.isSubscription);
   ```

3. **Database rollback:**
   ```javascript
   // Remove subscription-specific fields if needed
   db.paymentplans.updateMany(
     {},
     {
       $unset: {
         isSubscription: "",
         razorpayPlanId: "",
         maxMembers: "",
         maxCommunities: "",
         storageLimit: ""
       }
     }
   );
   ```

## Benefits of Migration

### For Users
- ✅ Flexible payment options (one-time or subscription)
- ✅ Better pricing with subscription discounts
- ✅ Automatic renewals (no payment interruptions)
- ✅ Easy subscription management

### For Business
- ✅ Predictable recurring revenue
- ✅ Reduced churn with auto-renewals
- ✅ Better customer lifetime value
- ✅ Comprehensive payment analytics

### For Developers
- ✅ Unified payment system
- ✅ Better code organization
- ✅ Comprehensive error handling
- ✅ Automated maintenance tasks

## Support

If you encounter issues during migration:

1. **Check logs** in browser console and server logs
2. **Verify environment variables** are set correctly
3. **Test webhook endpoints** using tools like ngrok
4. **Review Razorpay dashboard** for plan and subscription status

The migration is designed to be backward-compatible, so your existing functionality will continue to work while you gradually adopt the new features.
