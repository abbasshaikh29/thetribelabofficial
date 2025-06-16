# Razorpay Subscription System Implementation Guide

## Overview
This guide provides a complete implementation of Razorpay subscription system with auto-renewal functionality for your Next.js application.

## 1. Subscription Plan Creation

### A. Creating Plans in Razorpay Dashboard

1. **Login to Razorpay Dashboard**
   - Go to https://dashboard.razorpay.com
   - Navigate to "Subscriptions" → "Plans"

2. **Create a New Plan**
   ```
   Plan Name: Premium Monthly
   Billing Amount: ₹999
   Billing Cycle: Monthly (1 month)
   Description: Premium subscription with all features
   ```

3. **Plan Configuration**
   - Set billing cycle (monthly/yearly)
   - Configure trial period if needed
   - Add plan description and notes

### B. Creating Plans Programmatically

Use the API endpoint to create plans:

```typescript
// POST /api/subscriptions/plans
const planData = {
  name: "Premium Monthly",
  description: "Access to all premium features",
  amount: 999,
  currency: "INR",
  interval: "monthly",
  intervalCount: 1,
  planType: "platform", // or "community"
  features: [
    "Unlimited communities",
    "Advanced analytics",
    "Priority support",
    "Custom branding"
  ],
  trialPeriodDays: 7
};
```

## 2. Frontend Integration

### A. Subscription Checkout Component

```tsx
import SubscriptionCheckout from "@/components/subscriptions/SubscriptionCheckout";

// Usage in your component
<SubscriptionCheckout
  plan={selectedPlan}
  communityId={communityId} // optional
  onSuccess={(subscription) => {
    console.log("Subscription created:", subscription);
    // Handle success
  }}
  onError={(error) => {
    console.error("Subscription error:", error);
    // Handle error
  }}
  buttonText="Subscribe Now"
/>
```

### B. Subscription Management Dashboard

```tsx
import SubscriptionDashboard from "@/components/subscriptions/SubscriptionDashboard";

// Usage in your dashboard
<SubscriptionDashboard />
```

## 3. Backend Implementation

### A. Database Models

The implementation includes these models:
- `Subscription`: Main subscription tracking
- `SubscriptionPlan`: Plan definitions
- `User`: Updated with subscription fields
- `Transaction`: Payment tracking

### B. API Endpoints

1. **Plan Management**
   - `POST /api/subscriptions/plans` - Create plan
   - `GET /api/subscriptions/plans` - List plans

2. **Subscription Management**
   - `POST /api/subscriptions/create` - Create subscription
   - `POST /api/subscriptions/verify` - Verify payment
   - `GET /api/subscriptions/manage` - Get user subscriptions
   - `PUT /api/subscriptions/manage` - Update subscription
   - `DELETE /api/subscriptions/manage` - Cancel subscription

3. **Webhook Handling**
   - `POST /api/webhooks/razorpay` - Handle webhook events

## 4. Webhook Configuration

### A. Setting up Webhooks in Razorpay

1. **Go to Razorpay Dashboard**
   - Navigate to "Settings" → "Webhooks"
   - Click "Add New Webhook"

2. **Webhook Configuration**
   ```
   Webhook URL: https://yourdomain.com/api/webhooks/razorpay
   Secret: Generate a strong secret key
   Events to Subscribe:
   - subscription.charged
   - subscription.failed
   - subscription.cancelled
   - subscription.activated
   - subscription.completed
   - subscription.halted
   - invoice.issued
   ```

3. **Environment Variable**
   ```env
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
   ```

### B. Critical Webhook Events

1. **subscription.charged** - Successful renewal
   - Updates subscription status to "active"
   - Resets failure counters
   - Creates transaction record

2. **subscription.failed** - Payment failure
   - Updates status to "past_due"
   - Increments retry attempts
   - Schedules next retry

3. **subscription.cancelled** - Cancellation
   - Updates status to "cancelled"
   - Sets end date

4. **invoice.issued** - Upcoming renewal
   - Sends renewal reminder notifications

## 5. Auto-Renewal Setup

### A. Razorpay Auto-Renewal Configuration

Auto-renewal is handled automatically by Razorpay when:
1. Customer has a valid payment method
2. Subscription is in "active" status
3. Current cycle is ending

### B. Payment Retry Logic

The system implements 3-attempt retry logic:
1. **First Failure**: Retry after 24 hours
2. **Second Failure**: Retry after 48 hours  
3. **Third Failure**: Retry after 72 hours
4. **Final Failure**: Subscription moves to "halted" status

### C. Retry Configuration

```typescript
// In subscription creation
const subscription = {
  retryAttempts: 0,
  maxRetryAttempts: 3,
  nextRetryAt: null
};
```

## 6. Subscription Management Features

### A. Customer Actions

1. **View Subscriptions**
   ```typescript
   GET /api/subscriptions/manage
   ```

2. **Cancel Subscription**
   ```typescript
   PUT /api/subscriptions/manage
   {
     "subscriptionId": "sub_xxx",
     "action": "cancel",
     "cancelAtCycleEnd": true
   }
   ```

3. **Sync Status**
   ```typescript
   PUT /api/subscriptions/manage
   {
     "subscriptionId": "sub_xxx", 
     "action": "sync"
   }
   ```

### B. Admin Features

1. **Create Plans**: Admin can create subscription plans
2. **Monitor Subscriptions**: View all active subscriptions
3. **Handle Failures**: Manage failed payments

## 7. Security Best Practices

### A. Signature Verification

All webhook events and payments are verified using HMAC SHA256:

```typescript
// Webhook verification
const isValid = verifyWebhookSignature(body, signature, secret);

// Payment verification  
const isValid = verifySubscriptionSignature(subscriptionId, paymentId, signature);
```

### B. Environment Security

```env
# Use strong secrets
RAZORPAY_KEY_SECRET=strong_secret_here
RAZORPAY_WEBHOOK_SECRET=another_strong_secret
NEXTAUTH_SECRET=nextauth_secret

# Never expose secrets in frontend
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxx # Only public key
```

### C. PCI Compliance

- Never store card details
- Use Razorpay's secure checkout
- Implement proper error handling
- Log security events

## 8. Testing Guide

### A. Razorpay Test Environment

1. **Test Credentials**
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxx
   RAZORPAY_KEY_SECRET=test_secret
   ```

2. **Test Cards**
   ```
   Success: 4111 1111 1111 1111
   Failure: 4000 0000 0000 0002
   CVV: Any 3 digits
   Expiry: Any future date
   ```

### B. Testing Scenarios

1. **Successful Subscription**
   - Create subscription
   - Complete payment
   - Verify webhook events

2. **Failed Payment**
   - Use failure test card
   - Verify retry logic
   - Check notification system

3. **Cancellation**
   - Cancel active subscription
   - Verify immediate vs cycle-end cancellation

### C. Webhook Testing

Use tools like ngrok for local testing:
```bash
ngrok http 3000
# Use the HTTPS URL for webhook endpoint
```

## 9. Common Pitfalls and Solutions

### A. Webhook Issues

**Problem**: Webhooks not received
**Solution**: 
- Check webhook URL is accessible
- Verify SSL certificate
- Check firewall settings

**Problem**: Duplicate webhook processing
**Solution**:
- Implement idempotency checks
- Store webhook event IDs

### B. Payment Failures

**Problem**: High failure rates
**Solution**:
- Implement retry logic
- Send payment reminders
- Offer payment method updates

### C. Subscription Sync Issues

**Problem**: Local data out of sync
**Solution**:
- Implement sync endpoints
- Regular status checks
- Webhook event logging

## 10. Deployment Instructions

### A. Environment Setup

1. **Production Environment Variables**
   ```env
   RAZORPAY_KEY_ID=rzp_live_xxx
   RAZORPAY_KEY_SECRET=live_secret
   RAZORPAY_WEBHOOK_SECRET=webhook_secret
   ```

2. **Database Indexes**
   ```javascript
   // Run this in MongoDB
   db.subscriptions.createIndex({ "userId": 1, "status": 1 });
   db.subscriptions.createIndex({ "chargeAt": 1, "status": 1 });
   db.subscriptions.createIndex({ "nextRetryAt": 1, "status": 1 });
   ```

### B. Monitoring Setup

1. **Webhook Monitoring**
   - Set up alerts for webhook failures
   - Monitor webhook response times
   - Track event processing success rates

2. **Subscription Monitoring**
   - Monitor active subscription counts
   - Track churn rates
   - Alert on high failure rates

### C. Backup Strategy

1. **Database Backups**
   - Regular subscription data backups
   - Transaction history preservation
   - Webhook event logging

2. **Configuration Backups**
   - Environment variable backups
   - Razorpay plan configurations
   - Webhook endpoint configurations

## 11. Support and Maintenance

### A. Customer Support

1. **Subscription Issues**
   - Provide subscription lookup tools
   - Enable manual sync options
   - Offer payment method updates

2. **Billing Disputes**
   - Maintain transaction logs
   - Provide invoice generation
   - Enable refund processing

### B. System Maintenance

1. **Regular Tasks**
   - Monitor failed payments
   - Clean up old webhook events
   - Update subscription statuses

2. **Performance Optimization**
   - Optimize database queries
   - Cache subscription data
   - Monitor API response times

This implementation provides a robust, scalable subscription system with comprehensive error handling, security measures, and monitoring capabilities.
