/**
 * Script to create unlimited feature-based subscription plans
 * Run this script to set up the new subscription plans in your database
 */

const mongoose = require('mongoose');

// Define the plan schema (should match your model)
const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, required: true, default: "INR" },
  interval: { 
    type: String, 
    enum: ["monthly", "yearly"],
    required: true
  },
  intervalCount: { type: Number, default: 1 },
  trialPeriodDays: { type: Number, default: 14 },
  features: [{ type: String, required: true }],
  isActive: { type: Boolean, default: true },
  razorpayPlanId: { type: String, required: true },
  allowCustomBranding: { type: Boolean, default: false },
  prioritySupport: { type: Boolean, default: false },
  analyticsAccess: { type: Boolean, default: true },
  advancedAnalytics: { type: Boolean, default: false },
  apiAccess: { type: Boolean, default: false },
  whitelabelOptions: { type: Boolean, default: false },
  dedicatedSupport: { type: Boolean, default: false },
  customIntegrations: { type: Boolean, default: false }
}, { timestamps: true });

const CommunitySubscriptionPlan = mongoose.model('CommunitySubscriptionPlan', planSchema);

// Sample plans with unlimited usage and feature-based differentiation
const samplePlans = [
  {
    name: "Starter",
    description: "Perfect for small communities getting started",
    amount: 999,
    currency: "INR",
    interval: "monthly",
    intervalCount: 1,
    trialPeriodDays: 14,
    features: [
      "Unlimited members",
      "Unlimited storage", 
      "Unlimited events",
      "Unlimited channels",
      "Basic analytics",
      "Email support",
      "Mobile app access"
    ],
    razorpayPlanId: "plan_starter_monthly_unlimited", // You'll need to create this in Razorpay
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
    description: "Advanced features for growing communities",
    amount: 2999,
    currency: "INR", 
    interval: "monthly",
    intervalCount: 1,
    trialPeriodDays: 14,
    features: [
      "Everything in Starter",
      "Custom branding",
      "Priority support",
      "Advanced analytics",
      "API access",
      "Custom integrations",
      "Webhook support",
      "Export data"
    ],
    razorpayPlanId: "plan_professional_monthly_unlimited",
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
    description: "Full-featured solution for large organizations",
    amount: 4999,
    currency: "INR",
    interval: "monthly", 
    intervalCount: 1,
    trialPeriodDays: 14,
    features: [
      "Everything in Professional",
      "White-label options",
      "Dedicated support manager",
      "Custom domain",
      "SSO integration",
      "Advanced security",
      "Custom development",
      "SLA guarantee"
    ],
    razorpayPlanId: "plan_enterprise_monthly_unlimited",
    allowCustomBranding: true,
    prioritySupport: true,
    analyticsAccess: true,
    advancedAnalytics: true,
    apiAccess: true,
    whitelabelOptions: true,
    dedicatedSupport: true,
    customIntegrations: true,
    isActive: true
  },
  // Yearly plans with discount
  {
    name: "Starter Yearly",
    description: "Perfect for small communities - Save 20% with yearly billing",
    amount: 9990, // 20% discount from 11988 (999 * 12)
    currency: "INR",
    interval: "yearly",
    intervalCount: 1,
    trialPeriodDays: 14,
    features: [
      "Unlimited members",
      "Unlimited storage", 
      "Unlimited events",
      "Unlimited channels",
      "Basic analytics",
      "Email support",
      "Mobile app access",
      "Save 20% vs monthly"
    ],
    razorpayPlanId: "plan_starter_yearly_unlimited",
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
    name: "Professional Yearly",
    description: "Advanced features for growing communities - Save 20% with yearly billing",
    amount: 28790, // 20% discount from 35988 (2999 * 12)
    currency: "INR",
    interval: "yearly",
    intervalCount: 1,
    trialPeriodDays: 14,
    features: [
      "Everything in Starter",
      "Custom branding",
      "Priority support",
      "Advanced analytics",
      "API access",
      "Custom integrations",
      "Webhook support",
      "Export data",
      "Save 20% vs monthly"
    ],
    razorpayPlanId: "plan_professional_yearly_unlimited",
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
    name: "Enterprise Yearly",
    description: "Full-featured solution for large organizations - Save 20% with yearly billing",
    amount: 47990, // 20% discount from 59988 (4999 * 12)
    currency: "INR",
    interval: "yearly",
    intervalCount: 1,
    trialPeriodDays: 14,
    features: [
      "Everything in Professional",
      "White-label options",
      "Dedicated support manager",
      "Custom domain",
      "SSO integration",
      "Advanced security",
      "Custom development",
      "SLA guarantee",
      "Save 20% vs monthly"
    ],
    razorpayPlanId: "plan_enterprise_yearly_unlimited",
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
];

async function createPlans() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
    console.log('Connected to MongoDB');

    // Clear existing plans (optional - remove this if you want to keep existing plans)
    // await CommunitySubscriptionPlan.deleteMany({});
    // console.log('Cleared existing plans');

    // Create new plans
    const createdPlans = await CommunitySubscriptionPlan.insertMany(samplePlans);
    console.log(`Created ${createdPlans.length} subscription plans:`);
    
    createdPlans.forEach(plan => {
      console.log(`- ${plan.name}: ₹${plan.amount}/${plan.interval} (${plan.trialPeriodDays} day trial)`);
    });

    console.log('\n✅ All plans created successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Create corresponding plans in Razorpay Dashboard');
    console.log('2. Update the razorpayPlanId fields with actual Razorpay plan IDs');
    console.log('3. Test the subscription flow with test cards');

  } catch (error) {
    console.error('Error creating plans:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  createPlans();
}

module.exports = { createPlans, samplePlans };
