import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { PaymentGateway } from "@/models/PaymentGateway";
import { createPlan } from "@/lib/razorpay";
import { CommunitySubscriptionPlan } from "@/models/PaymentPlan";
import { decrypt } from "@/lib/encryption";

/**
 * POST /api/community/[slug]/create-plans
 * Body: { monthlyPrice: number, annualPrice: number, currency?: string }
 * Creates Razorpay plans in the community admin's account and stores them in DB.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { monthlyPrice, annualPrice, currency = "INR" } = await request.json();
    if (!monthlyPrice && !annualPrice) {
      return NextResponse.json(
        { error: "At least one of monthlyPrice or annualPrice is required" },
        { status: 400 }
      );
    }

    // Validate currency format (ISO 4217: three uppercase letters)
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json(
        { error: "Invalid currency format. Use 3-letter ISO code (e.g., INR, USD)" },
        { status: 400 }
      );
    }

    await dbconnect();

    const resolvedParams = await context.params;
    const { slug } = resolvedParams;

    const community = await Community.findOne({ slug });
    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    // Ensure requester is the community admin
    if (community.admin !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!community.paymentGatewayId) {
      return NextResponse.json({ error: "Community has no payment gateway set" }, { status: 400 });
    }

    const gateway = await PaymentGateway.findById(community.paymentGatewayId);
    if (!gateway) {
      return NextResponse.json({ error: "Payment gateway not found" }, { status: 404 });
    }

    if (!gateway.credentials || typeof gateway.credentials !== "object") {
      return NextResponse.json({ error: "Gateway credentials missing" }, { status: 500 });
    }

    const { apiKey: encApiKey, secretKey: encSecretKey } = gateway.credentials as { apiKey?: string; secretKey?: string };
    const apiKey = encApiKey ? decrypt(encApiKey) : undefined;
    const secretKey = encSecretKey ? decrypt(encSecretKey) : undefined;
    if (!apiKey || !secretKey) {
      return NextResponse.json({ error: "Gateway credentials incomplete" }, { status: 500 });
    }

    // Verify gateway ownership
    if (gateway.ownerId && gateway.ownerId.toString() !== community.admin.toString()) {
      return NextResponse.json({ error: "Invalid gateway configuration" }, { status: 403 });
    }

    const createdPlans: any[] = [];

    // Helper to create plan and save to DB
    async function makePlan(amount: number, period: "monthly" | "yearly") {
      const planRes = await createPlan(
        {
          period,
          interval: 1,
          item: {
            name: `${community.name} ${period === "monthly" ? "Monthly" : "Annual"} Plan`,
            amount: amount * 100, // paise
            currency,
            description: `Subscription for ${community.name}`,
          },
        },
        { apiKey: apiKey!, secretKey: secretKey! }
      );

      const dbPlan = new CommunitySubscriptionPlan({
        name: planRes.item.name,
        description: planRes.item.description,
        amount: planRes.item.amount,
        currency: planRes.item.currency,
        interval: period,
        intervalCount: 1,
        trialPeriodDays: 0,
        features: ["Community access"],
        isActive: true,
        razorpayPlanId: planRes.id,
        allowCustomBranding: false,
        prioritySupport: false,
        analyticsAccess: true,
        advancedAnalytics: false,
        apiAccess: false,
        whitelabelOptions: false,
        dedicatedSupport: false,
        customIntegrations: false,
      });

      await dbPlan.save();
      return dbPlan;
    }

    if (monthlyPrice) {
      createdPlans.push(await makePlan(monthlyPrice, "monthly"));
    }
    if (annualPrice) {
      createdPlans.push(await makePlan(annualPrice, "yearly"));
    }

    // Attach to community
    community.paymentPlans = [
      ...(community.paymentPlans || []),
      ...createdPlans.map((p) => p._id),
    ];
    await community.save();

    return NextResponse.json({ success: true, plans: createdPlans });
  } catch (error: any) {
    console.error("Error creating plans:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create plans" },
      { status: 500 }
    );
  }
} 