#!/usr/bin/env node

/**
 * Script to initialize subscription plans for the community management system
 * This script creates both database records and corresponding Razorpay plans
 */

const mongoose = require('mongoose');
const fetch = require('node-fetch');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/thetribelabofficial';

// Razorpay configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error('❌ Razorpay credentials not found in environment variables');
  console.error('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
  process.exit(1);
}

// Community Subscription Plan Schema (simplified for script)
const CommunitySubscriptionPlanSchema = new mongoose.Schema({
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
}, {
  timestamps: true
});

const CommunitySubscriptionPlan = mongoose.model('CommunitySubscriptionPlan', CommunitySubscriptionPlanSchema);

// Function to create Razorpay plan
async function createRazorpayPlan(planData) {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  
  const response = await fetch('https://api.razorpay.com/v1/plans', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(planData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Razorpay API error: ${errorData.error?.description || 'Unknown error'}`);
  }

  return await response.json();
}

// Default subscription plans
const defaultPlans = [
  {
    name: "Community Starter",
    description: "Perfect for small communities getting started",
    amount: 999, // ₹9.99 in paise
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
    name: "Community Pro",
    description: "Advanced features for growing communities",
    amount: 2999, // ₹29.99 in paise
    currency: "INR",
    interval: "monthly",
    intervalCount: 1,
    trialPeriodDays: 14,
    features: [
      "Everything in Starter",
      "Advanced analytics",
      "Custom branding",
      "Priority support",
      "API access",
      "Custom integrations",
      "White-label options"
    ],
    allowCustomBranding: true,
    prioritySupport: true,
    analyticsAccess: true,
    advancedAnalytics: true,
    apiAccess: true,
    whitelabelOptions: true,
    dedicatedSupport: false,
    customIntegrations: true,
    isActive: true
  },
  {
    name: "Community Enterprise",
    description: "Full-featured plan for large organizations",
    amount: 9999, // ₹99.99 in paise
    currency: "INR",
    interval: "monthly",
    intervalCount: 1,
    trialPeriodDays: 14,
    features: [
      "Everything in Pro",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantees",
      "Advanced security",
      "Custom development"
    ],
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

async function initializePlans() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if plans already exist
    const existingPlans = await CommunitySubscriptionPlan.find({ isActive: true });
    
    if (existingPlans.length > 0) {
      console.log(`ℹ️  Found ${existingPlans.length} existing plans:`);
      existingPlans.forEach(plan => {
        console.log(`   - ${plan.name}: ₹${plan.amount/100}/${plan.interval} (Razorpay: ${plan.razorpayPlanId})`);
      });
      
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        readline.question('Do you want to create additional plans? (y/N): ', resolve);
      });
      
      readline.close();
      
      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('✅ Keeping existing plans');
        process.exit(0);
      }
    }

    console.log('🔄 Creating subscription plans...');
    const createdPlans = [];

    for (const planData of defaultPlans) {
      try {
        console.log(`\n📝 Creating plan: ${planData.name}`);
        
        // Check if plan with same name already exists
        const existingPlan = await CommunitySubscriptionPlan.findOne({ 
          name: planData.name, 
          isActive: true 
        });
        
        if (existingPlan) {
          console.log(`   ⚠️  Plan "${planData.name}" already exists, skipping...`);
          continue;
        }

        // Create plan in Razorpay first
        const razorpayPlanData = {
          period: planData.interval,
          interval: planData.intervalCount,
          item: {
            name: `${planData.name} - Community Management`,
            amount: planData.amount,
            currency: planData.currency,
            description: planData.description
          },
          notes: {
            planType: "community_management",
            features: planData.features.join(","),
            customBranding: planData.allowCustomBranding.toString(),
            prioritySupport: planData.prioritySupport.toString(),
            advancedAnalytics: planData.advancedAnalytics.toString()
          }
        };

        console.log('   🔄 Creating Razorpay plan...');
        const razorpayPlan = await createRazorpayPlan(razorpayPlanData);
        console.log(`   ✅ Razorpay plan created: ${razorpayPlan.id}`);

        // Create plan in database
        const dbPlan = new CommunitySubscriptionPlan({
          ...planData,
          razorpayPlanId: razorpayPlan.id
        });

        await dbPlan.save();
        createdPlans.push(dbPlan);

        console.log(`   ✅ Database plan created: ${dbPlan._id}`);
        console.log(`   💰 Price: ₹${planData.amount/100}/${planData.interval}`);
        console.log(`   🎯 Features: ${planData.features.length} features`);
        
      } catch (planError) {
        console.error(`   ❌ Error creating plan ${planData.name}:`, planError.message);
        // Continue with other plans
      }
    }

    console.log(`\n🎉 Successfully created ${createdPlans.length} subscription plans!`);
    
    if (createdPlans.length > 0) {
      console.log('\n📋 Summary:');
      createdPlans.forEach(plan => {
        console.log(`   - ${plan.name}: ₹${plan.amount/100}/${plan.interval} (${plan.trialPeriodDays} day trial)`);
        console.log(`     Razorpay ID: ${plan.razorpayPlanId}`);
      });
    }

  } catch (error) {
    console.error('❌ Error initializing plans:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  initializePlans();
}

module.exports = { initializePlans, defaultPlans };
