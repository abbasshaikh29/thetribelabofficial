# Community Trial Reminder Notification System

## Overview

This document describes the comprehensive trial reminder notification system implemented for community administrators. The system provides automated notifications, UI alerts, and suspension management for 14-day free trials.

## Features

### 🔔 **Automated Trial Reminders**
- Notifications sent at 7, 3, 2, and 1 days before trial expiration
- Multi-channel delivery: Email + In-app notifications + Persistent banners
- Escalating urgency levels based on days remaining
- Duplicate prevention with tracking in database

### 💳 **Enhanced "Pay Now" Functionality**
- Context-aware payment buttons throughout the application
- Prominent placement in billing dashboard and settings modal
- Trial conversion buttons with urgency messaging
- Post-payment redirects to community slug URLs

### 🚫 **Automatic Community Suspension**
- Communities suspended immediately when trial expires
- Clear messaging to admin and members about suspension
- Data preservation with immediate restoration upon payment
- Webhook integration for seamless reactivation

### 📧 **Professional Email Templates**
- Responsive HTML email templates
- Urgency-based styling and messaging
- Clear call-to-action buttons
- Comprehensive feature listings and policy information

## System Architecture

### **Core Components**

1. **CommunityTrialNotificationService** (`src/lib/community-trial-notifications.ts`)
   - Main service for sending trial reminders
   - Handles notification scheduling and content generation
   - Tracks sent notifications to prevent duplicates

2. **CommunitySuspensionService** (`src/lib/community-suspension-service.ts`)
   - Manages community suspension and reactivation
   - Handles expired trial processing
   - Sends suspension and reactivation notifications

3. **TrialReminderBanner** (`src/components/trial/TrialReminderBanner.tsx`)
   - Persistent UI banner for trial warnings
   - Responsive design with urgency levels
   - Dismissible with smart re-showing logic

4. **Enhanced PayNowButton** (`src/components/payments/PayNowButton.tsx`)
   - Context-aware payment buttons
   - Multiple variants for different use cases
   - Integration with existing Razorpay checkout

5. **SuspendedCommunityPage** (`src/components/community/SuspendedCommunityPage.tsx`)
   - Full-page suspension notice
   - Admin reactivation interface
   - Member information display

### **Database Schema Updates**

#### CommunitySubscription Model
```typescript
// Trial reminder tracking
trialReminders: Array<{
  daysRemaining: number;
  sentAt: Date;
  emailSent: boolean;
  inAppSent: boolean;
  metadata?: Record<string, any>;
}>;
```

## Cron Jobs

### **Daily Trial Management** (`/api/cron/community-trial-management`)
- Runs comprehensive trial management
- Sends reminder notifications
- Processes expired trials
- Suspends communities as needed

### **Individual Endpoints**
- `/api/cron/community-trial-reminders` - Trial reminders only
- `/api/cron/process-expired-trials` - Suspension processing only

### **Cron Schedule Recommendation**
```bash
# Run daily at 9:00 AM UTC
0 9 * * * curl -H "Authorization: Bearer ${CRON_SECRET}" ${BASE_URL}/api/cron/community-trial-management
```

## Notification Flow

### **Trial Reminder Timeline**

| Days Remaining | Urgency Level | Email Subject | Banner Color | Actions |
|----------------|---------------|---------------|--------------|---------|
| 7 days | Medium | "Reminder: Trial expires in 7 days" | Yellow | Email + In-app + Banner |
| 3 days | High | "Important: Trial expires in 3 days" | Orange | Email + In-app + Banner |
| 2 days | High | "Important: Trial expires in 2 days" | Orange | Email + In-app + Banner |
| 1 day | Critical | "URGENT: Trial expires tomorrow" | Red | Email + In-app + Banner |
| 0 days | Expired | "Community Suspended" | Red | Suspension + Email |

### **Email Content Structure**
1. **Header** - TheTribeLab branding
2. **Urgency Notice** - Color-coded alert box
3. **Trial Details** - Community name, expiration date, days remaining
4. **Impact Warning** - What happens after expiration
5. **Call-to-Action** - Prominent "Subscribe Now" button
6. **Feature Benefits** - Unlimited features list
7. **Footer** - Support contact and policies

## Integration Points

### **Existing Systems**
- **Razorpay Integration** - Uses existing subscription flow
- **Webhook System** - Integrates with current webhook handlers
- **Notification System** - Extends existing in-app notifications
- **Email Service** - Uses existing email infrastructure
- **Settings Modal** - Integrates with modal-based UI pattern

### **Community Billing Context**
- Integrates with `useCommunityBilling` hook
- Displays in existing billing dashboard
- Works with settings modal tabs
- Respects user preferences for slug URLs

## Configuration

### **Environment Variables**
```bash
# Required for cron job authentication
CRON_SECRET=your-secure-cron-secret

# Email configuration (existing)
EMAIL_FROM=noreply@thetribelab.com
SMTP_HOST=your-smtp-host
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password

# Razorpay configuration (existing)
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_COMMUNITY_PLAN_ID=your-plan-id

# Application URL
NEXTAUTH_URL=https://your-domain.com
```

### **Notification Thresholds**
```typescript
// Customizable in src/lib/community-trial-notifications.ts
const TRIAL_REMINDER_DAYS = [7, 3, 2, 1];
```

## Usage Examples

### **Adding Trial Banner to Community Pages**
```tsx
import TrialReminderBanner from '@/components/trial/TrialReminderBanner';

function CommunityPage() {
  return (
    <div>
      <TrialReminderBanner 
        communityId={community._id}
        communitySlug={community.slug}
      />
      {/* Rest of community content */}
    </div>
  );
}
```

### **Adding Pay Now Button**
```tsx
import { UrgentPayNowButton } from '@/components/payments/PayNowButton';

function BillingSection() {
  return (
    <UrgentPayNowButton
      communityId={communityId}
      communitySlug={communitySlug}
      context="trial_reminder"
      onSuccess={(subscription) => {
        // Handle successful payment
      }}
    />
  );
}
```

### **Manual Trigger (Testing)**
```bash
# Trigger all trial management
curl -X POST ${BASE_URL}/api/cron/community-trial-management

# Trigger only reminders
curl -X POST ${BASE_URL}/api/cron/community-trial-management \
  -H "Content-Type: application/json" \
  -d '{"action": "reminders"}'

# Trigger only suspensions
curl -X POST ${BASE_URL}/api/cron/community-trial-management \
  -H "Content-Type: application/json" \
  -d '{"action": "suspensions"}'
```

## Monitoring and Logging

### **Cron Job Logs**
- All operations logged with timestamps
- Error tracking and reporting
- Success/failure metrics
- Detailed processing results

### **Key Metrics to Monitor**
- Trial reminders sent per day
- Email delivery success rates
- Communities suspended per day
- Conversion rates from trial to paid
- Payment completion rates after reminders

## Security Considerations

- **Cron Authentication** - Bearer token authentication for cron endpoints
- **Data Privacy** - Minimal personal data in logs
- **Email Security** - Secure SMTP configuration
- **Payment Security** - Existing Razorpay security measures
- **Access Control** - Admin-only suspension management

## Testing

### **Manual Testing**
1. Create test community with trial
2. Manually adjust trial end date in database
3. Trigger cron jobs manually
4. Verify notifications and UI updates
5. Test payment flow and reactivation

### **Automated Testing**
- Unit tests for notification services
- Integration tests for cron jobs
- Email template rendering tests
- Payment flow testing

## Troubleshooting

### **Common Issues**
1. **Notifications not sending** - Check cron job authentication and email configuration
2. **Duplicate notifications** - Verify database tracking is working
3. **Payment failures** - Check Razorpay configuration and webhook setup
4. **UI not updating** - Verify context providers and state management

### **Debug Endpoints**
- Check subscription status: `/api/admin/cleanup-subscription-data`
- Manual notification trigger: `/api/cron/community-trial-management` (POST)
- Webhook testing: `/api/webhooks/razorpay` (with test data)

## Future Enhancements

- SMS notifications for critical reminders
- Customizable reminder schedules per community
- A/B testing for email templates
- Advanced analytics dashboard
- Grace period options for failed payments
- Bulk suspension management for admins
