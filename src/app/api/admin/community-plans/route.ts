import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { CommunityPlan } from "@/models/CommunityPlan";
import { Community } from "@/models/Community";
import mongoose from "mongoose";

// Validation function for plan data
function validatePlanData(planFields: any, isCreate: boolean = false): string[] {
  const errors: string[] = [];

  // Required fields for creation
  if (isCreate) {
    if (!planFields.name || typeof planFields.name !== 'string' || planFields.name.trim().length === 0) {
      errors.push('Plan name is required and must be a non-empty string');
    }
    if (planFields.amount === undefined || typeof planFields.amount !== 'number' || planFields.amount < 0) {
      errors.push('Amount is required and must be a non-negative number');
    }
    if (!planFields.currency || typeof planFields.currency !== 'string') {
      errors.push('Currency is required');
    }
    if (!planFields.interval || typeof planFields.interval !== 'string') {
      errors.push('Interval is required');
    }
  }

  // Validate name
  if (planFields.name !== undefined) {
    if (typeof planFields.name !== 'string' || planFields.name.trim().length === 0) {
      errors.push('Plan name must be a non-empty string');
    } else if (planFields.name.trim().length > 100) {
      errors.push('Plan name must be 100 characters or less');
    }
  }

  // Validate description
  if (planFields.description !== undefined) {
    if (typeof planFields.description !== 'string') {
      errors.push('Description must be a string');
    } else if (planFields.description.length > 500) {
      errors.push('Description must be 500 characters or less');
    }
  }

  // Validate amount
  if (planFields.amount !== undefined) {
    if (typeof planFields.amount !== 'number' || planFields.amount < 0) {
      errors.push('Amount must be a non-negative number');
    } else if (planFields.amount > 10000000) { // 100,000 rupees in paise
      errors.push('Amount cannot exceed ₹100,000');
    }
  }

  // Validate currency
  if (planFields.currency !== undefined) {
    if (typeof planFields.currency !== 'string' || !['INR', 'USD'].includes(planFields.currency)) {
      errors.push('Currency must be either INR or USD');
    }
  }

  // Validate interval
  if (planFields.interval !== undefined) {
    const validIntervals = ['monthly', 'yearly', 'one_time'];
    if (typeof planFields.interval !== 'string' || !validIntervals.includes(planFields.interval)) {
      errors.push('Interval must be one of: monthly, yearly, one_time');
    }
  }

  // Validate intervalCount
  if (planFields.intervalCount !== undefined) {
    if (typeof planFields.intervalCount !== 'number' || planFields.intervalCount < 1 || planFields.intervalCount > 12) {
      errors.push('Interval count must be a number between 1 and 12');
    }
  }

  // Validate features
  if (planFields.features !== undefined) {
    if (!Array.isArray(planFields.features)) {
      errors.push('Features must be an array');
    } else {
      planFields.features.forEach((feature: any, index: number) => {
        if (typeof feature !== 'string' || feature.trim().length === 0) {
          errors.push(`Feature at index ${index} must be a non-empty string`);
        } else if (feature.length > 200) {
          errors.push(`Feature at index ${index} must be 200 characters or less`);
        }
      });
      if (planFields.features.length > 20) {
        errors.push('Cannot have more than 20 features');
      }
    }
  }

  // Validate trialPeriodDays
  if (planFields.trialPeriodDays !== undefined) {
    if (typeof planFields.trialPeriodDays !== 'number' || planFields.trialPeriodDays < 0 || planFields.trialPeriodDays > 365) {
      errors.push('Trial period days must be a number between 0 and 365');
    }
  }

  // Validate setupFee
  if (planFields.setupFee !== undefined) {
    if (typeof planFields.setupFee !== 'number' || planFields.setupFee < 0) {
      errors.push('Setup fee must be a non-negative number');
    } else if (planFields.setupFee > 5000000) { // 50,000 rupees in paise
      errors.push('Setup fee cannot exceed ₹50,000');
    }
  }

  // Validate boolean fields
  const booleanFields = ['isActive', 'isPublic', 'requiresApproval', 'isDefault'];
  booleanFields.forEach(field => {
    if (planFields[field] !== undefined && typeof planFields[field] !== 'boolean') {
      errors.push(`${field} must be a boolean value`);
    }
  });

  // Validate accessLevel
  if (planFields.accessLevel !== undefined) {
    const validAccessLevels = ['basic', 'premium', 'vip'];
    if (typeof planFields.accessLevel !== 'string' || !validAccessLevels.includes(planFields.accessLevel)) {
      errors.push('Access level must be one of: basic, premium, vip');
    }
  }

  // Business rule validations
  if (planFields.amount !== undefined && planFields.setupFee !== undefined) {
    if (planFields.setupFee > planFields.amount) {
      errors.push('Setup fee cannot be greater than the plan amount');
    }
  }

  // Validate that one_time plans don't have trial periods
  if (planFields.interval === 'one_time' && planFields.trialPeriodDays !== undefined && planFields.trialPeriodDays > 0) {
    errors.push('One-time plans cannot have trial periods');
  }

  return errors;
}

// GET /api/admin/community-plans - Get all plans for a community
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { searchParams } = new URL(request.url);
    const communityId = searchParams.get('communityId');

    if (!communityId) {
      return NextResponse.json(
        { error: "Community ID is required" },
        { status: 400 }
      );
    }

    // Verify admin owns the community
    const community = await (Community as any).findOne({
      _id: communityId,
      adminId: session.user.id
    });

    if (!community) {
      return NextResponse.json(
        { error: "Community not found or access denied" },
        { status: 404 }
      );
    }

    // Get all plans for the community
    const plans = await (CommunityPlan as any).find({
      communityId,
      adminId: session.user.id
    }).sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      plans
    });

  } catch (error: unknown) {
    console.error("Get community plans error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch plans";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/admin/community-plans - Create a new plan
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const planData = await request.json();
    const { communityId, ...planFields } = planData;

    if (!communityId) {
      return NextResponse.json(
        { error: "Community ID is required" },
        { status: 400 }
      );
    }

    // Validate plan data
    const validationErrors = validatePlanData(planFields, true);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationErrors
        },
        { status: 400 }
      );
    }

    // Verify admin owns the community
    const community = await (Community as any).findOne({
      _id: communityId,
      adminId: session.user.id
    });

    if (!community) {
      return NextResponse.json(
        { error: "Community not found or access denied" },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!planFields.name || !planFields.amount || planFields.amount <= 0) {
      return NextResponse.json(
        { error: "Plan name and valid amount are required" },
        { status: 400 }
      );
    }

    let plan;

    // If setting as default, use transaction to prevent race conditions
    if (planFields.isDefault) {
      const mongoSession = await mongoose.startSession();

      try {
        await mongoSession.withTransaction(async () => {
          // Unset other default plans
          await CommunityPlan.updateMany(
            { communityId, adminId: session.user.id },
            { isDefault: false },
            { session: mongoSession }
          );

          // Create the plan
          plan = new CommunityPlan({
            ...planFields,
            adminId: session.user.id,
            communityId,
            totalSubscribers: 0,
            totalRevenue: 0,
            conversionRate: 0
          });

          await plan.save({ session: mongoSession });
        });
      } finally {
        await mongoSession.endSession();
      }
    } else {
      // Create the plan without transaction for non-default plans
      plan = new CommunityPlan({
        ...planFields,
        adminId: session.user.id,
        communityId,
        totalSubscribers: 0,
        totalRevenue: 0,
        conversionRate: 0
      });

      await plan.save();
    }

    // Create Razorpay plan if needed (for recurring subscriptions)
    if (planFields.interval !== 'one_time') {
      try {
        await createRazorpayPlan(plan);
      } catch (razorpayError) {
        console.error("Razorpay plan creation failed:", razorpayError);
        // Continue without failing the entire operation
      }
    }

    return NextResponse.json({
      success: true,
      message: "Plan created successfully",
      plan
    });

  } catch (error: unknown) {
    console.error("Create community plan error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create plan";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Helper function to create Razorpay plan
async function createRazorpayPlan(plan: any) {
  const Razorpay = (await import('razorpay')).default;
  
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const razorpayPlan = await razorpay.plans.create({
    period: plan.interval === 'monthly' ? 'monthly' : 'yearly',
    interval: plan.intervalCount,
    item: {
      name: plan.name,
      amount: plan.amount, // Amount in paise
      currency: plan.currency,
      description: plan.description || `${plan.name} subscription`
    },
    notes: {
      community_id: plan.communityId.toString(),
      admin_id: plan.adminId.toString(),
      plan_id: plan._id.toString()
    }
  });

  // Update plan with Razorpay plan ID
  plan.razorpayPlanId = razorpayPlan.id;
  await plan.save();

  return razorpayPlan;
}
