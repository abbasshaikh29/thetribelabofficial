import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { CommunitySubscription } from "@/models/Subscription";

// This route expects STRIPE_WEBHOOK_SECRET env var.

export async function POST(request: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json({ error: "Stripe env vars missing" }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: "2022-11-15" });

  const rawBody = await request.arrayBuffer();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(Buffer.from(rawBody), sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed", err.message);
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  try {
    await dbconnect();

    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        // Retrieve metadata values
        const communityId = intent.metadata?.communityId;
        if (communityId) {
          // Update community subscription status
          await Community.findByIdAndUpdate(communityId, {
            subscriptionStatus: "active",
          });
          // TODO: Create subscription record or update if needed
        }
        break;
      }
      default:
        console.log("Unhandled Stripe event", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook handler error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 