# Migration to Subscription-Only System for Community Administrators

## Overview

This migration transforms your payment system from a mixed one-time/subscription model to a **pure subscription-only system** specifically designed for community administrators. Community admins will pay recurring fees to the platform for hosting and managing their communities.

## What Changed

### ❌ **Removed (One-Time Payments)**
- All one-time payment components and APIs
- Mixed payment plan models
- End-user payment flows
- Platform subscription options

### ✅ **New (Subscription-Only for Community Admins)**
- Community-focused subscription plans
- Admin-specific payment flows
- Community usage tracking and limits
- Auto-renewal for uninterrupted community service
- Admin-centric billing notifications

## Key Features

### 🏢 **Community Administrator Focus**
- **Who Pays**: Only community administrators (not end users)
- **What They Pay For**: Community hosting, management, and platform services
- **Payment Frequency**: Recurring monthly/yearly subscriptions
- **Auto-Renewal**: Automatic to ensure uninterrupted community service

### 🚀 **Unlimited Usage Model**
All subscription plans include:
- **Unlimited Members**: No restrictions on community size
- **Unlimited Storage**: No limits on file and media storage
- **Unlimited Events**: Create as many events as needed
- **Unlimited Channels**: No restrictions on channels/forums
- **Feature-Based Pricing**: Plans differentiated by premium features, not usage limits

### 🔄 **Automatic Renewal System**
- **Trial Period**: 14-day free trial for new communities
- **Auto-Renewal**: Seamless recurring payments
- **Retry Logic**: 3 attempts with 24-hour intervals
- **Grace Period**: Community remains active during retry attempts
- **Suspension**: Community archived after final payment failure

## Database Schema Changes

### New Models

#### `CommunitySubscriptionPlan`
```typescript
{
  name: string;                    // "Starter", "Professional", "Enterprise"
  amount: number;                  // Monthly/yearly price
  interval: "monthly" | "yearly";
  features: string[];              // Feature list
  trialPeriodDays: number;         // Free trial days (default: 14)
  razorpayPlanId: string;          // Razorpay plan ID
  // Feature flags (no usage limits)
  allowCustomBranding: boolean;
  prioritySupport: boolean;
  analyticsAccess: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  whitelabelOptions: boolean;
  dedicatedSupport: boolean;
  customIntegrations: boolean;
}
```

#### Updated `User` Model
```typescript
{
  communityAdminSubscription: {
    razorpayCustomerId: string;
    adminSubscriptions: [{
      communityId: ObjectId;
      subscriptionId: string;
      subscriptionStatus: string;
      planId: ObjectId;
      // ... billing details
    }];
    totalFailedPayments: number;
    notificationPreferences: {
      renewalReminders: boolean;
      paymentFailures: boolean;
      trialExpiry: boolean;
    };
  }
}
```

#### Updated `Community` Model
```typescript
{
  subscriptionPlanId: ObjectId;     // Required subscription plan
  subscriptionStatus: string;       // "trial" | "active" | "past_due" | "expired"
  subscriptionId: string;           // Razorpay subscription ID
  subscriptionStartDate: Date;
  subscriptionEndDate: Date;
  trialEndDate: Date;
  // No usage tracking - unlimited access for all plans
}
```

## API Endpoints

### Community Subscription Plans
```
GET    /api/community-subscription-plans          # List all plans
POST   /api/community-subscription-plans          # Create new plan (admin only)
GET    /api/community-subscription-plans/[id]     # Get specific plan
PUT    /api/community-subscription-plans          # Update plan
DELETE /api/community-subscription-plans          # Delete plan
```

### Community Subscriptions
```
POST   /api/community-subscriptions/create        # Create admin subscription
POST   /api/community-subscriptions/verify        # Verify payment
GET    /api/subscriptions/manage                   # Get admin subscriptions
PUT    /api/subscriptions/manage                   # Update subscription
```

### Webhooks
```
POST   /api/webhooks/razorpay                     # Handle subscription events
```

## Component Usage

### For Community Creation/Management
```tsx
import CommunitySubscriptionManager from "@/components/admin/CommunitySubscriptionManager";

// In community admin dashboard
<CommunitySubscriptionManager 
  communityId={communityId}
  showPlanSelection={true}
/>
```

### For Direct Plan Checkout
```tsx
import CommunitySubscriptionCheckout from "@/components/payments/RazorpayCheckout";

<CommunitySubscriptionCheckout
  planId={selectedPlan._id}
  communityId={communityId}
  onSuccess={(data) => {
    // Handle successful subscription
    router.push(`/admin/community/${communityId}`);
  }}
  onError={(error) => {
    // Handle error
    console.error("Subscription failed:", error);
  }}
/>
```

## Migration Steps

### 1. Environment Variables
```env
# Existing Razorpay credentials
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_public_key

# Required for subscriptions
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
CRON_SECRET=your_cron_secret
```

### 2. Database Migration
```javascript
// Create subscription plans (unlimited usage, feature-based)
db.communitysubscriptionplans.insertMany([
  {
    name: "Starter",
    amount: 999,
    interval: "monthly",
    features: ["Basic Support", "Standard Analytics", "Unlimited Everything"],
    trialPeriodDays: 14,
    razorpayPlanId: "plan_starter_monthly",
    allowCustomBranding: false,
    prioritySupport: false,
    analyticsAccess: true,
    advancedAnalytics: false,
    apiAccess: false,
    whitelabelOptions: false,
    dedicatedSupport: false,
    customIntegrations: false,
    isActive: true
  },
  {
    name: "Professional",
    amount: 2999,
    interval: "monthly",
    features: ["Priority Support", "Advanced Analytics", "Custom Branding", "API Access", "Unlimited Everything"],
    trialPeriodDays: 14,
    razorpayPlanId: "plan_pro_monthly",
    allowCustomBranding: true,
    prioritySupport: true,
    analyticsAccess: true,
    advancedAnalytics: true,
    apiAccess: true,
    whitelabelOptions: false,
    dedicatedSupport: false,
    customIntegrations: true,
    isActive: true
  },
  {
    name: "Enterprise",
    amount: 4999,
    interval: "monthly",
    features: ["Dedicated Support", "White-label Options", "Custom Integrations", "Advanced Analytics", "API Access", "Unlimited Everything"],
    trialPeriodDays: 14,
    razorpayPlanId: "plan_enterprise_monthly",
    allowCustomBranding: true,
    prioritySupport: true,
    analyticsAccess: true,
    advancedAnalytics: true,
    apiAccess: true,
    whitelabelOptions: true,
    dedicatedSupport: true,
    customIntegrations: true,
    isActive: true
  }
]);

// Update existing communities to require subscriptions (14-day trial, no usage tracking)
db.communities.updateMany(
  {},
  {
    $set: {
      subscriptionStatus: "trial",
      subscriptionStartDate: new Date(),
      trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    },
    $unset: {
      currentMembers: "",
      currentStorage: "",
      currentEvents: "",
      currentChannels: ""
    }
  }
);
```

### 3. Webhook Configuration
Set up webhooks in Razorpay Dashboard:
```
URL: https://yourdomain.com/api/webhooks/razorpay
Secret: your_webhook_secret
Events:
- subscription.charged
- subscription.failed  
- subscription.cancelled
- subscription.activated
- subscription.completed
- subscription.halted
- invoice.issued
```

### 4. Cron Job Setup
```bash
# Add to cron or use Vercel Cron
# Run every hour to handle subscription maintenance
0 * * * * curl -H "Authorization: Bearer your_cron_secret" https://yourdomain.com/api/cron/subscription-maintenance
```

## Business Logic

### Community Lifecycle
1. **Creation**: Community starts with 14-day trial
2. **Trial Period**: Full unlimited access to all community features
3. **Trial Expiry**: Admin must subscribe to continue
4. **Active Subscription**: Recurring payments, unlimited access continues
5. **Payment Failure**: Grace period with retry attempts
6. **Suspension**: Community archived after final failure

### No Usage Enforcement
```typescript
// No limits to check - all communities have unlimited access
// Focus on feature access based on subscription plan
const community = await Community.findById(communityId).populate('subscriptionPlanId');
const plan = community.subscriptionPlanId;

// Check feature access instead of usage limits
if (plan.allowCustomBranding) {
  // Enable custom branding features
}
if (plan.advancedAnalytics) {
  // Enable advanced analytics
}
```

### Admin Notifications
- **7 days before renewal**: Renewal reminder
- **Payment failure**: Immediate notification with retry info
- **Final attempt**: Critical warning about suspension
- **Suspension**: Community archived notification

## Testing

### Test Plans Creation
```typescript
// Create test subscription plans
const testPlan = {
  name: "Test Plan",
  amount: 1, // ₹1 for testing
  interval: "monthly",
  features: ["Test Feature", "Unlimited Everything"],
  trialPeriodDays: 1, // 1 day for quick testing
  allowCustomBranding: true,
  prioritySupport: false,
  analyticsAccess: true,
  advancedAnalytics: false,
  apiAccess: false,
  whitelabelOptions: false,
  dedicatedSupport: false,
  customIntegrations: false
};
```

### Test Cards
```
Success: 4111 1111 1111 1111
Failure: 4000 0000 0000 0002
CVV: Any 3 digits
Expiry: Any future date
```

### Test Scenarios
1. **New Community**: Create community → Start trial → Subscribe
2. **Payment Success**: Successful recurring payment
3. **Payment Failure**: Failed payment → Retry logic → Recovery
4. **Cancellation**: Cancel subscription → Grace period → Archive

## Monitoring

### Key Metrics
- **Active Subscriptions**: Number of paying communities
- **Trial Conversions**: Trial-to-paid conversion rate
- **Churn Rate**: Monthly subscription cancellations
- **Payment Failures**: Failed payment percentage
- **Revenue**: Monthly recurring revenue (MRR)

### Alerts
- High payment failure rates (>5%)
- Low trial conversion rates (<20%)
- Subscription cancellation spikes
- Webhook processing failures

## Support

### Admin Support Features
- Subscription status dashboard
- Payment history and invoices
- Usage tracking and limits
- Plan upgrade/downgrade options
- Billing issue resolution

### Common Issues
1. **Payment Failures**: Guide admins to update payment methods
2. **Feature Access**: Help admins understand plan differences
3. **Trial Expiry**: Smooth transition to paid plans (14-day trial)
4. **Cancellation**: Exit surveys and retention offers

This unlimited subscription-only system ensures predictable revenue while providing community administrators with unlimited access to core features and premium add-ons based on their chosen plan. The focus shifts from usage restrictions to feature differentiation, creating a more user-friendly experience.
