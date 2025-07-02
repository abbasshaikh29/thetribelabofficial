import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { PaymentGateway } from "@/models/PaymentGateway";
import Stripe from "stripe";
import { createOrder as createRazorpayOrder } from "@/lib/razorpay";
import { decrypt } from "@/lib/encryption";

// POST /api/payments/create-order
export async function POST(request: NextRequest) {
  try {
    const { slug } = await request.json();
    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    // Validate slug format: 3-50 chars, alphanumeric and hyphens
    if (typeof slug !== "string" || !/^[a-zA-Z0-9-]{3,50}$/.test(slug)) {
      return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });
    }

    const sanitizedSlug = slug.trim().toLowerCase();

    await dbconnect();
    const community = await Community.findOne({ slug: sanitizedSlug });
    if (!community || !community.paymentGatewayId) {
      return NextResponse.json(
        { error: "Community or payment gateway not found" },
        { status: 404 }
      );
    }
    const gateway = await PaymentGateway.findById(community.paymentGatewayId);
    if (!gateway) {
      return NextResponse.json(
        { error: "Payment gateway not found" },
        { status: 404 }
      );
    }

    // Verify gateway ownership
    if (gateway.ownerId && gateway.ownerId.toString() !== community.admin.toString()) {
      return NextResponse.json({ error: "Invalid gateway configuration" }, { status: 403 });
    }

    if (gateway.name === "stripe") {
      // Initialize Stripe SDK
      if (!gateway.credentials || typeof gateway.credentials !== "object") {
        return NextResponse.json({ error: "Gateway credentials missing" }, { status: 500 });
      }

      const creds = gateway.credentials as { apiKey?: string; secretKey?: string };
      const stripeSecret = creds.secretKey ? decrypt(creds.secretKey) : process.env.STRIPE_SECRET_KEY;
      if (!stripeSecret) {
        return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
      }
      const stripe = new Stripe(stripeSecret, { apiVersion: "2022-11-15" });

      const intent = await stripe.paymentIntents.create({
        amount: Math.round((community.price || 0) * 100), // cents
        currency: community.currency?.toLowerCase() || "usd",
        metadata: { communityId: community._id.toString(), slug: sanitizedSlug },
      });

      return NextResponse.json({ gateway: "stripe", session: { client_secret: intent.client_secret } });
    }

    if (gateway.name === "razorpay") {
      try {
        if (!gateway.credentials || typeof gateway.credentials !== "object") {
          return NextResponse.json(
            { error: "Razorpay credentials not configured" },
            { status: 500 }
          );
        }

        const creds = gateway.credentials as { apiKey?: string; secretKey?: string };
        const apiKey = creds.apiKey ? decrypt(creds.apiKey) : undefined;
        const secretKey = creds.secretKey ? decrypt(creds.secretKey) : undefined;
        if (!apiKey || !secretKey) {
          return NextResponse.json(
            { error: "Razorpay credentials not configured" },
            { status: 500 }
          );
        }

        const auth = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");

        // Build payload – amount should be in the smallest unit (paise)
        const amountPaise = Math.round((community.price || 0) * 100);

        const response = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amountPaise,
            currency: community.currency || "INR",
            receipt: `community_${community._id}`,
            notes: { slug: sanitizedSlug },
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          console.error("Razorpay order error", errData);
          return NextResponse.json(
            { error: errData.error?.description || "Failed to create order" },
            { status: 500 }
          );
        }

        const order = await response.json();

        return NextResponse.json({ gateway: "razorpay", session: order });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Unsupported gateway" }, { status: 400 });
  } catch (error: any) {
    console.error("Create order error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}