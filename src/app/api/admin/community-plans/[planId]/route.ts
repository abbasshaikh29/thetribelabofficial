import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { CommunityPlan } from "@/models/CommunityPlan";
import { Community } from "@/models/Community";
import mongoose from "mongoose";

// Helper function to validate MongoDB ObjectId
function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id) && (new mongoose.Types.ObjectId(id)).toString() === id;
}

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

// GET /api/admin/community-plans/[planId] - Get specific plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;

  // Validate planId as a valid MongoDB ObjectId
  if (!isValidObjectId(planId)) {
    return NextResponse.json(
      { error: "Invalid plan ID format" },
      { status: 400 }
    );
  }

  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const plan = await (CommunityPlan as any).findOne({
      _id: new mongoose.Types.ObjectId(planId),
      adminId: new mongoose.Types.ObjectId(session.user.id)
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      plan
    });

  } catch (error: unknown) {
    console.error("Get plan error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch plan";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PUT /api/admin/community-plans/[planId] - Update plan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;

  // Validate planId as a valid MongoDB ObjectId
  if (!isValidObjectId(planId)) {
    return NextResponse.json(
      { error: "Invalid plan ID format" },
      { status: 400 }
    );
  }

  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const updateData = await request.json();
    const { ...planFields } = updateData;

    // Validate update data
    const validationErrors = validatePlanData(planFields);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationErrors
        },
        { status: 400 }
      );
    }

    // Find the plan
    const plan = await (CommunityPlan as any).findOne({
      _id: new mongoose.Types.ObjectId(planId),
      adminId: new mongoose.Types.ObjectId(session.user.id)
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // If setting as default, use transaction to prevent race conditions
    if (planFields.isDefault && !plan.isDefault) {
      const mongoSession = await mongoose.startSession();

      try {
        await mongoSession.withTransaction(async () => {
          // Unset other default plans
          await (CommunityPlan as any).updateMany(
            {
              communityId: plan.communityId,
              adminId: session.user.id,
              _id: { $ne: planId }
            },
            { isDefault: false },
            { session: mongoSession }
          );

          // Update the current plan
          Object.assign(plan, planFields);
          await plan.save({ session: mongoSession });
        });
      } finally {
        await mongoSession.endSession();
      }
    } else {
      // Update the plan without transaction for non-default changes
      Object.assign(plan, planFields);
      await plan.save();
    }

    return NextResponse.json({
      success: true,
      message: "Plan updated successfully",
      plan
    });

  } catch (error: unknown) {
    console.error("Update plan error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update plan";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/community-plans/[planId] - Partial update (e.g., toggle active)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;

  // Validate planId as a valid MongoDB ObjectId
  if (!isValidObjectId(planId)) {
    return NextResponse.json(
      { error: "Invalid plan ID format" },
      { status: 400 }
    );
  }

  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const updateData = await request.json();

    // Validate update data
    const validationErrors = validatePlanData(updateData);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationErrors
        },
        { status: 400 }
      );
    }

    // Check if we're setting this plan as default
    const isSettingAsDefault = updateData.isDefault === true;

    let plan: any;

    if (isSettingAsDefault) {
      // Use transaction to prevent race conditions when setting default
      const mongoSession = await mongoose.startSession();

      try {
        await mongoSession.withTransaction(async () => {
          // First, find the current plan to check if it's already default
          const currentPlan = await (CommunityPlan as any).findOne({
            _id: new mongoose.Types.ObjectId(planId),
            adminId: new mongoose.Types.ObjectId(session.user.id)
          }).session(mongoSession);

          if (!currentPlan) {
            throw new Error("Plan not found");
          }

          // If not already default, unset other default plans
          if (!currentPlan.isDefault) {
            await (CommunityPlan as any).updateMany(
              {
                communityId: currentPlan.communityId,
                adminId: session.user.id,
                _id: { $ne: planId }
              },
              { isDefault: false },
              { session: mongoSession }
            );
          }

          // Update the current plan
          plan = await (CommunityPlan as any).findOneAndUpdate(
            {
              _id: new mongoose.Types.ObjectId(planId),
              adminId: new mongoose.Types.ObjectId(session.user.id)
            },
            updateData,
            { new: true, session: mongoSession }
          );
        });
      } finally {
        await mongoSession.endSession();
      }
    } else {
      // Update without transaction for non-default changes
      plan = await (CommunityPlan as any).findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(planId),
          adminId: new mongoose.Types.ObjectId(session.user.id)
        },
        updateData,
        { new: true }
      );
    }

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Plan updated successfully",
      plan
    });

  } catch (error: unknown) {
    console.error("Patch plan error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update plan";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/community-plans/[planId] - Delete plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;

  // Validate planId as a valid MongoDB ObjectId
  if (!isValidObjectId(planId)) {
    return NextResponse.json(
      { error: "Invalid plan ID format" },
      { status: 400 }
    );
  }

  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    // Find the plan
    const plan = await (CommunityPlan as any).findOne({
      _id: new mongoose.Types.ObjectId(planId),
      adminId: new mongoose.Types.ObjectId(session.user.id)
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // Check if plan has active subscribers
    if (plan.totalSubscribers > 0) {
      return NextResponse.json(
        { error: "Cannot delete plan with active subscribers" },
        { status: 400 }
      );
    }

    // Use transaction to ensure atomicity of deletion and default plan reassignment
    const mongoSession = await mongoose.startSession();

    try {
      await mongoSession.withTransaction(async () => {
        // Delete the plan
        await (CommunityPlan as any).findByIdAndDelete(new mongoose.Types.ObjectId(planId), { session: mongoSession });

        // If this was the default plan, set another plan as default
        if (plan.isDefault) {
          const nextPlan = await (CommunityPlan as any).findOne({
            communityId: plan.communityId,
            adminId: new mongoose.Types.ObjectId(session.user.id),
            isActive: true
          }).session(mongoSession);

          if (nextPlan) {
            nextPlan.isDefault = true;
            await nextPlan.save({ session: mongoSession });
          }
        }
      });
    } finally {
      await mongoSession.endSession();
    }

    return NextResponse.json({
      success: true,
      message: "Plan deleted successfully"
    });

  } catch (error: unknown) {
    console.error("Delete plan error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to delete plan";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
