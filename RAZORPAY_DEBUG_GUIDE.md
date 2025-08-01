# Razorpay Authentication Debug Guide

## Current Issue
Your application is experiencing "Authentication failed" errors when trying to access the Razorpay API. This is preventing subscription status checks and other Razorpay operations.

## Error Details
```
Error: Razorpay API error: Authentication failed
at fetchSubscription (src\lib\razorpay.ts:512:12)
```

## Root Cause Analysis

### 1. Credential Validation Results
Our test script confirmed that the current Razorpay credentials are **not working**:
- Basic API Access: ❌ FAIL
- Subscription API Access: ❌ FAIL  
- Specific Subscription Access: ❌ FAIL

### 2. Current Credentials in .env.development
```env
RAZORPAY_KEY_ID=rzp_test_roLmqg06NZd3yN
RAZORPAY_KEY_SECRET=qkWjKaYPJdd9QEcNrar6wD93
```

## Possible Causes

### 1. Invalid/Expired Credentials
- The credentials may be incorrect or have been regenerated
- Test credentials might have expired
- Account access may have been revoked

### 2. Wrong Environment
- Using test credentials when live credentials are needed
- Using credentials from a different Razorpay account

### 3. Account Issues
- Razorpay account may be suspended or have restrictions
- API access may be disabled for the account

## Solution Steps

### Step 1: Verify Razorpay Account Access
1. **Login to Razorpay Dashboard**
   - Go to https://dashboard.razorpay.com/
   - Login with your account credentials

2. **Check Account Status**
   - Ensure your account is active and verified
   - Check for any notifications or restrictions

### Step 2: Generate New API Credentials
1. **Navigate to API Keys**
   - Go to Settings → API Keys
   - Or direct link: https://dashboard.razorpay.com/app/keys

2. **For Test Environment:**
   - Click on "Test Mode" 
   - Generate new test API keys
   - Copy the Key ID and Key Secret

3. **For Live Environment:**
   - Click on "Live Mode"
   - Generate new live API keys (only if account is activated)
   - Copy the Key ID and Key Secret

### Step 3: Update Environment Variables
Replace the credentials in `.env.development`:

```env
# Razorpay Test Credentials (replace with your actual credentials)
RAZORPAY_KEY_ID=rzp_test_YOUR_NEW_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_NEW_KEY_SECRET

NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_YOUR_NEW_KEY_ID
```

### Step 4: Set Up Webhook Secrets
1. **In Razorpay Dashboard:**
   - Go to Settings → Webhooks
   - Create or update webhook endpoints
   - Generate webhook secrets

2. **Update .env.development:**
```env
RAZORPAY_WEBHOOK_SECRET=your_actual_webhook_secret
RAZORPAY_ROUTE_WEBHOOK_SECRET=your_route_webhook_secret
```

### Step 5: Verify Plan Configuration
1. **Check if Plan Exists:**
   - Go to Subscriptions → Plans in Razorpay dashboard
   - Look for plan ID: `plan_QhCbaOaLsGCPlP`
   - If it doesn't exist, create a new plan

2. **Update Plan ID if needed:**
```env
RAZORPAY_COMMUNITY_PLAN_ID=your_actual_plan_id
```

### Step 6: Test the Fix
Run the test script again:
```bash
node test-razorpay-credentials.js
```

## Subscription Data Issue

### Current Problematic Subscription
The error logs show a subscription ID: `sub_QhXTvrfCNmbUrA`

This subscription might:
1. Belong to a different Razorpay account
2. Have been created with different credentials
3. No longer exist

### Database Cleanup (if needed)
If the subscription belongs to a different account, you may need to:

1. **Check the database:**
```javascript
// In MongoDB or your admin panel
db.communities.find({ subscriptionId: "sub_QhXTvrfCNmbUrA" })
```

2. **Clear invalid subscription data:**
```javascript
// Only if confirmed the subscription is from wrong account
db.communities.updateMany(
  { subscriptionId: "sub_QhXTvrfCNmbUrA" },
  { $unset: { subscriptionId: "", subscriptionStatus: "", subscriptionEndDate: "" } }
)
```

## Prevention Measures

### 1. Environment Variable Validation
Add validation in your startup code:
```typescript
// In your app startup
import { checkRazorpayConfig } from '@/lib/razorpay';

try {
  checkRazorpayConfig();
  console.log('✅ Razorpay configuration is valid');
} catch (error) {
  console.error('❌ Razorpay configuration error:', error.message);
  // Handle the error appropriately
}
```

### 2. Graceful Error Handling
Update your subscription status check to handle authentication errors:
```typescript
// In trial-service.ts or similar
try {
  subscriptionDetails = await fetchSubscription(community.subscriptionId);
} catch (err) {
  console.error("Error fetching subscription details:", err);
  
  // If it's an authentication error, log it specifically
  if (err.message.includes('Authentication failed')) {
    console.error('🔑 Razorpay authentication failed - check credentials');
  }
  
  // Continue without subscription details instead of crashing
  subscriptionDetails = null;
}
```

## Next Steps

1. **Immediate:** Get new Razorpay credentials from your dashboard
2. **Update:** Replace credentials in environment files
3. **Test:** Run the test script to verify
4. **Monitor:** Check application logs for continued errors
5. **Clean up:** Remove any invalid subscription references if needed

## Support Resources

- **Razorpay Documentation:** https://razorpay.com/docs/
- **API Reference:** https://razorpay.com/docs/api/
- **Support:** https://razorpay.com/support/

## Test Script Usage

The `test-razorpay-credentials.js` script will help you verify:
- ✅ Basic API connectivity
- ✅ Subscription API access  
- ✅ Specific subscription validation
- ✅ Credential format verification

Run it after each change to ensure your credentials are working correctly.
