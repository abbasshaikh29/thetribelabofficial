# Razorpay Plan Setup Guide

## Creating a Pre-existing Plan in Razorpay Dashboard

To use the subscription system, you need to create a plan manually in your Razorpay dashboard.

### Step 1: Login to Razorpay Dashboard
1. Go to https://dashboard.razorpay.com
2. Login with your credentials

### Step 2: Navigate to Subscriptions
1. In the left sidebar, click on "Subscriptions"
2. Click on "Plans"

### Step 3: Create New Plan
Click "Create Plan" and fill in the following details:

**Plan Details:**
- **Plan Name**: Community Management Plan
- **Plan Description**: Complete community management solution with unlimited features
- **Billing Amount**: ₹2,400 (24.00 INR)
- **Billing Cycle**: Monthly (1 month)
- **Plan Type**: Subscription

**Advanced Settings:**
- **Trial Period**: 0 days (we handle trial in our application)
- **Setup Fee**: ₹0
- **Plan Status**: Active

### Step 4: Get Plan ID
After creating the plan, you'll get a Plan ID that looks like: `plan_xxxxxxxxxx`

### Step 5: Set Environment Variable
Add the Plan ID to your environment variables:

```bash
# In your .env.local file
RAZORPAY_COMMUNITY_PLAN_ID=plan_QhCbaOaLsGCPlP
```

## Current Plan Configuration
The system is currently configured to use plan ID: `plan_QhCbaOaLsGCPlP`

This plan should be configured in your Razorpay dashboard with:
- Amount: ₹2,400 (24.00 INR)
- Billing Cycle: Monthly
- Status: Active

## Benefits of Pre-existing Plans
1. **Reliability**: No dynamic plan creation errors
2. **Performance**: Faster subscription creation
3. **Consistency**: Same plan used across all subscriptions
4. **Management**: Easy to modify plan details in dashboard
5. **Analytics**: Better tracking in Razorpay dashboard

## Subscription Flow
1. User clicks "Start 14-Day Free Trial"
2. System creates subscription using pre-existing plan
3. 14-day trial period handled by application logic
4. After trial, Razorpay automatically charges monthly
5. Webhooks handle subscription status updates

## Important Notes
- The plan amount should be ₹2,400 (displayed as $29/month to users)
- Trial period is handled in application, not in Razorpay plan
- Plan should be set to "Active" status
- Monthly billing cycle is recommended
