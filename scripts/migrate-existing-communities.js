/**
 * Migration script to update existing communities with subscription plans
 * This script will:
 * 1. Create a default "Starter" subscription plan if it doesn't exist
 * 2. Update all existing communities to use this default plan
 * 3. Set them to trial status with 14-day trial period
 */

const mongoose = require('mongoose');

// Community Schema (simplified for migration)
const communitySchema = new mongoose.Schema({
  name: String,
  slug: String,
  subscriptionPlanId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "CommunitySubscriptionPlan"
  },
  subscriptionStatus: { 
    type: String, 
    enum: ["trial", "active", "past_due", "cancelled", "expired"], 
    default: "trial" 
  },
  subscriptionId: String,
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  trialEndDate: Date
}, { timestamps: true });

// Subscription Plan Schema
const planSchema = new mongoose.Schema({
  name: String,
  description: String,
  amount: Number,
  currency: { type: String, default: "INR" },
  interval: { type: String, enum: ["monthly", "yearly"] },
  intervalCount: { type: Number, default: 1 },
  trialPeriodDays: { type: Number, default: 14 },
  features: [String],
  isActive: { type: Boolean, default: true },
  razorpayPlanId: String,
  allowCustomBranding: { type: Boolean, default: false },
  prioritySupport: { type: Boolean, default: false },
  analyticsAccess: { type: Boolean, default: true },
  advancedAnalytics: { type: Boolean, default: false },
  apiAccess: { type: Boolean, default: false },
  whitelabelOptions: { type: Boolean, default: false },
  dedicatedSupport: { type: Boolean, default: false },
  customIntegrations: { type: Boolean, default: false }
}, { timestamps: true });

const Community = mongoose.model('Community', communitySchema);
const CommunitySubscriptionPlan = mongoose.model('CommunitySubscriptionPlan', planSchema);

// Default starter plan for existing communities
const defaultStarterPlan = {
  name: "Legacy Starter",
  description: "Default plan for existing communities during migration",
  amount: 0, // Free during migration
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
    "Legacy community access"
  ],
  razorpayPlanId: "plan_legacy_starter_free", // Placeholder - not used for free plan
  allowCustomBranding: false,
  prioritySupport: false,
  analyticsAccess: true,
  advancedAnalytics: false,
  apiAccess: false,
  whitelabelOptions: false,
  dedicatedSupport: false,
  customIntegrations: false,
  isActive: true
};

async function migrateCommunities() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
    console.log('Connected to MongoDB');

    // Step 1: Create or find default starter plan
    let starterPlan = await CommunitySubscriptionPlan.findOne({ name: "Legacy Starter" });
    
    if (!starterPlan) {
      starterPlan = await CommunitySubscriptionPlan.create(defaultStarterPlan);
      console.log('✅ Created default "Legacy Starter" plan');
    } else {
      console.log('✅ Found existing "Legacy Starter" plan');
    }

    // Step 2: Find communities without subscription plans
    const communitiesWithoutPlans = await Community.find({
      $or: [
        { subscriptionPlanId: { $exists: false } },
        { subscriptionPlanId: null }
      ]
    });

    console.log(`📊 Found ${communitiesWithoutPlans.length} communities without subscription plans`);

    if (communitiesWithoutPlans.length === 0) {
      console.log('✅ All communities already have subscription plans');
      return;
    }

    // Step 3: Update communities with default plan and trial status
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

    const updateResult = await Community.updateMany(
      {
        $or: [
          { subscriptionPlanId: { $exists: false } },
          { subscriptionPlanId: null }
        ]
      },
      {
        $set: {
          subscriptionPlanId: starterPlan._id,
          subscriptionStatus: "trial",
          subscriptionStartDate: now,
          trialEndDate: trialEndDate
        }
      }
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} communities with subscription plans`);

    // Step 4: Verify the migration
    const updatedCommunities = await Community.find({
      subscriptionPlanId: starterPlan._id
    }).populate('subscriptionPlanId');

    console.log('\n📋 Migration Summary:');
    console.log(`- Default plan: ${starterPlan.name}`);
    console.log(`- Communities updated: ${updateResult.modifiedCount}`);
    console.log(`- Trial period: 14 days`);
    console.log(`- Trial end date: ${trialEndDate.toLocaleDateString()}`);

    // Step 5: Show sample of updated communities
    if (updatedCommunities.length > 0) {
      console.log('\n📝 Sample updated communities:');
      updatedCommunities.slice(0, 5).forEach(community => {
        console.log(`- ${community.name}: ${community.subscriptionStatus} (trial ends: ${community.trialEndDate?.toLocaleDateString()})`);
      });
      
      if (updatedCommunities.length > 5) {
        console.log(`... and ${updatedCommunities.length - 5} more`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Test community join functionality');
    console.log('2. Create proper subscription plans using the create-unlimited-plans.js script');
    console.log('3. Allow community admins to upgrade from the legacy plan');
    console.log('4. Consider making subscriptionPlanId required again after migration');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Function to rollback migration if needed
async function rollbackMigration() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
    console.log('Connected to MongoDB for rollback');

    // Remove subscription fields from communities
    const rollbackResult = await Community.updateMany(
      {},
      {
        $unset: {
          subscriptionPlanId: "",
          subscriptionStatus: "",
          subscriptionId: "",
          subscriptionStartDate: "",
          subscriptionEndDate: "",
          trialEndDate: ""
        }
      }
    );

    console.log(`✅ Rolled back ${rollbackResult.modifiedCount} communities`);

    // Optionally remove the legacy starter plan
    const deletedPlan = await CommunitySubscriptionPlan.findOneAndDelete({ name: "Legacy Starter" });
    if (deletedPlan) {
      console.log('✅ Removed "Legacy Starter" plan');
    }

    console.log('✅ Rollback completed');

  } catch (error) {
    console.error('❌ Rollback failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run migration or rollback based on command line argument
if (require.main === module) {
  const action = process.argv[2];
  
  if (action === 'rollback') {
    rollbackMigration();
  } else {
    migrateCommunities();
  }
}

module.exports = { migrateCommunities, rollbackMigration };
