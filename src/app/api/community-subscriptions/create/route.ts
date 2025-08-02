import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { createCustomer, createSubscription } from "@/lib/razorpay";
import { CommunitySubscription } from "@/models/Subscription";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";
import { User } from "@/models/User";
import { Community } from "@/models/Community";
import {
  getSafeSubscriptionDates,
  calculateTrialEndDate,
} from "@/lib/subscription-date-utils";
import mongoose from "mongoose";

// POST /api/community-subscriptions/create - Create a new community subscription for admin
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const {
      communityId, // Optional - for existing communities upgrading
      adminId = session.user.id,
      customerNotify = true,
      notes = {},
    } = await request.json();

    // Validate communityId format and find community
    let community;
    if (communityId) {
      try {
        // First check if it's a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(communityId)) {
          return NextResponse.json(
            { error: "Invalid community ID format" },
            { status: 400 }
          );
        }

        // Then try to find the community
        community = await Community.findById(communityId);
        if (!community) {
          return NextResponse.json(
            { error: "Community not found" },
            { status: 404 }
          );
        }

        // Verify the user is the admin
        if (community.admin.toString() !== session.user.id) {
          return NextResponse.json(
            { error: "Only community admin can create subscription" },
            { status: 403 }
          );
        }
      } catch (error) {
        console.error("Error validating community:", error);
        return NextResponse.json(
          { error: "Failed to validate community" },
          { status: 500 }
        );
      }
    }

    // Single standardized plan - $29/month processed as ₹2,400
    // Note: We handle trial period in our application logic, not in Razorpay plan
    const standardPlan = {
      name: "Community Management Plan",
      description:
        "Complete community management solution with unlimited features",
      amount: 240000, // ₹2,400 in paise ($29/month)
      currency: "INR",
      interval: "monthly" as const,
      intervalCount: 1,
      trialPeriodDays: 14, // For our internal tracking only
      features: [
        "Unlimited members",
        "Unlimited storage",
        "Unlimited events",
        "Unlimited channels",
        "Basic analytics",
        "Email support",
      ],
    };

    const plan = standardPlan;

    // Get admin user details
    const adminUser = await User.findById(adminId);
    if (!adminUser) {
      return NextResponse.json(
        { error: "Admin user not found" },
        { status: 404 }
      );
    }

    // Check if admin already has an active subscription for this community
    if (community) {
      const existingSubscription = await CommunitySubscription.findOne({
        adminId: adminId,
        communityId: community._id,
        status: { $in: ["active", "trial", "past_due"] },
      });

      if (existingSubscription) {
        return NextResponse.json(
          { error: "Community already has an active subscription" },
          { status: 400 }
        );
      }
    }

    let customerId = adminUser.communityAdminSubscription?.razorpayCustomerId;

    // Create customer if doesn't exist
    if (!customerId) {
      const customerData = {
        name: adminUser.name || adminUser.email,
        email: adminUser.email,
        contact: adminUser.phone || undefined,
        notes: {
          userId: adminId,
          role: "community_admin",
          createdAt: new Date().toISOString(),
        },
      };

      try {
        const razorpayCustomer = await createCustomer(customerData);
        customerId = razorpayCustomer.id;
      } catch (error: any) {
        // Handle the case where customer already exists
        if (error.message && error.message.includes("Customer already exists")) {
          console.log(`Customer already exists for email: ${adminUser.email}`);
          
          // Fetch the existing customer by email
          // We need to search for customers by email
          try {
            const response = await fetch(`https://api.razorpay.com/v1/customers?email=${encodeURIComponent(adminUser.email)}`, {
              method: "GET",
              headers: {
                Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
                "Content-Type": "application/json",
              },
            });
            
            if (response.ok) {
              const customersData = await response.json();
              if (customersData.items && customersData.items.length > 0) {
                // Use the first matching customer
                customerId = customersData.items[0].id;
                console.log(`Using existing customer: ${customerId}`);
              } else {
                throw new Error("Customer exists but could not be found in search results");
              }
            } else {
              throw new Error("Failed to search for existing customer");
            }
          } catch (searchError) {
            console.error("Error searching for existing customer:", searchError);
            throw new Error("Customer already exists but could not be retrieved. Please contact support.");
          }
        } else {
          // Re-throw other errors
          throw error;
        }
      }

      // Update user with customer ID
      await User.findByIdAndUpdate(adminId, {
        "communityAdminSubscription.razorpayCustomerId": customerId,
      });
    }

    // Calculate trial end date (for our internal tracking)
    const trialEndDate =
      plan.trialPeriodDays > 0
        ? calculateTrialEndDate(plan.trialPeriodDays)
        : undefined;

    // Use pre-existing plan ID from environment variables
    // This plan should be created manually in Razorpay dashboard
    const RAZORPAY_PLAN_ID =
      process.env.RAZORPAY_COMMUNITY_PLAN_ID || "plan_QhCbaOaLsGCPlP";

    console.log("Using pre-existing Razorpay plan:", RAZORPAY_PLAN_ID);

    // Prepare minimal subscription data using pre-existing plan
    const subscriptionData = {
      plan_id: RAZORPAY_PLAN_ID,
      customer_id: customerId,
      quantity: 1,
      total_count: 120, // 120 monthly payments (10 years)
      customer_notify: customerNotify,
      notes: {
        ...notes,
        communityId: community?._id?.toString() || "new",
        adminEmail: adminUser.email,
        planName: "Community Management Plan"
      }
    };

    console.log("Creating Razorpay subscription with data:", subscriptionData);

    // Create subscription in Razorpay
    const razorpaySubscription = await createSubscription(subscriptionData);
    console.log("Razorpay subscription created:", razorpaySubscription.id);
    console.log("Razorpay subscription data:", {
      status: razorpaySubscription.status,
      current_start: razorpaySubscription.current_start,
      current_end: razorpaySubscription.current_end,
      charge_at: razorpaySubscription.charge_at,
      start_at: razorpaySubscription.start_at,
      end_at: razorpaySubscription.end_at,
    });

    // Calculate dates with proper validation and fallbacks using utility function
    const safeSubscriptionDates = getSafeSubscriptionDates(
      razorpaySubscription,
      plan
    );
    const { currentStart, currentEnd, chargeAt, startAt, endAt } =
      safeSubscriptionDates;

    console.log("Calculated subscription dates:", {
      currentStart: currentStart.toISOString(),
      currentEnd: currentEnd.toISOString(),
      chargeAt: chargeAt.toISOString(),
    });

    // Before saving subscription, ensure a valid community exists
    if (!community) {
      return NextResponse.json(
        { error: "A valid community ID is required to create subscription" },
        { status: 400 }
      );
    }

    // Save subscription to database
    const subscription = new CommunitySubscription({
      razorpaySubscriptionId: razorpaySubscription.id,
      razorpayPlanId: RAZORPAY_PLAN_ID,
      razorpayCustomerId: customerId,
      adminId: adminId,
      communityId: community._id,
      status: razorpaySubscription.status,
      currentStart,
      currentEnd,
      chargeAt,
      startAt: startAt,
      endAt: endAt,
      authAttempts: razorpaySubscription.auth_attempts,
      totalCount: razorpaySubscription.total_count,
      paidCount: razorpaySubscription.paid_count,
      customerNotify: razorpaySubscription.customer_notify,
      quantity: razorpaySubscription.quantity,
      notes: razorpaySubscription.notes,
      amount: plan.amount,
      currency: plan.currency,
      interval: plan.interval,
      intervalCount: plan.intervalCount,
      trialEndDate: trialEndDate,
      retryAttempts: 0,
      maxRetryAttempts: 3,
      consecutiveFailures: 0,
      webhookEvents: [],
      notificationsSent: [],
    });

    await subscription.save();

    // Update user's admin subscription status
    await User.findByIdAndUpdate(adminId, {
      "communityAdminSubscription.razorpayCustomerId": customerId,
      "communityAdminSubscription.subscriptionId": razorpaySubscription.id,
      "communityAdminSubscription.subscriptionStatus":
        razorpaySubscription.status === "created"
          ? "trial"
          : razorpaySubscription.status,
      "communityAdminSubscription.subscriptionEndDate": currentEnd,
      "communityAdminSubscription.trialEndDate": trialEndDate,
    });

    // If community exists, update its subscription status
    if (community) {
      // Calculate proper end date based on subscription status
      let subscriptionEndDate: Date;

      if (
        razorpaySubscription.status === "created" &&
        plan.trialPeriodDays > 0
      ) {
        // For trial subscriptions, use the trial period (14 days)
        subscriptionEndDate = new Date(currentStart);
        subscriptionEndDate.setDate(
          subscriptionEndDate.getDate() + plan.trialPeriodDays
        );
      } else {
        // For active subscriptions, use the full subscription period (30 days)
        subscriptionEndDate = new Date(currentStart);
        subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);
      }

      console.log("Setting community subscription dates:", {
        subscriptionStartDate: currentStart,
        subscriptionEndDate: subscriptionEndDate,
        trialEndDate: trialEndDate,
        subscriptionStatus: razorpaySubscription.status,
        trialPeriodDays: plan.trialPeriodDays,
      });

      await Community.findByIdAndUpdate(community._id, {
        subscriptionStatus:
          razorpaySubscription.status === "created"
            ? "trial"
            : razorpaySubscription.status,
        subscriptionId: razorpaySubscription.id,
        subscriptionStartDate: currentStart,
        subscriptionEndDate: subscriptionEndDate,
        trialEndDate,
        paymentStatus:
          razorpaySubscription.status === "active"
            ? "paid"
            : plan.trialPeriodDays > 0
              ? "trial"
              : "unpaid",
        freeTrialActivated: plan.trialPeriodDays > 0 ? true : false,
      });
    }

    return NextResponse.json({
      success: true,
      subscription,
      razorpaySubscription,
      shortUrl: razorpaySubscription.short_url,
      trialEndDate,
      message:
        plan.trialPeriodDays > 0
          ? `${plan.trialPeriodDays}-day free trial started. Unlimited access to all community features. Payment will be charged on ${chargeAt.toLocaleDateString()}`
          : "Subscription created successfully - unlimited community access activated",
    });
  } catch (error: any) {
    console.error("Error creating community subscription:", error);

    // Provide more specific error messages
    let errorMessage = "Failed to create subscription";
    if (error.message) {
      errorMessage = error.message;
    }

    // Handle specific Razorpay errors
    if (error.message && error.message.includes("Razorpay API error")) {
      errorMessage = error.message;
    }

    // Handle database validation errors
    if (error.name === "ValidationError") {
      errorMessage = `Database validation error: ${error.message}`;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
