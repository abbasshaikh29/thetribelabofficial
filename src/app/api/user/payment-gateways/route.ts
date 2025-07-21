import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { PaymentGateway, IPaymentGateway } from "@/models/PaymentGateway";
import { encrypt, decrypt } from "@/lib/encryption";

/**
 * GET /api/user/payment-gateways
 * Returns all gateways owned by the current user.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const gateways = await PaymentGateway.find({ ownerId: session.user.id });

    // Decrypt sensitive fields before sending
    const decryptedGateways = gateways.map((g: IPaymentGateway) => {
      const creds = g.credentials || {};
      const resultCreds: Record<string, any> = { ...creds };
      if (g.name === "razorpay") {
        if (creds.apiKey) resultCreds.apiKey = decrypt(creds.apiKey);
        if (creds.secretKey) resultCreds.secretKey = decrypt(creds.secretKey);
      }
      if (g.name === "stripe") {
        if (creds.secretKey) resultCreds.secretKey = decrypt(creds.secretKey);
      }
      return {
        ...(g as any).toObject(),
        credentials: resultCreds,
      };
    });

    return NextResponse.json({ success: true, gateways: decryptedGateways });
  } catch (error: any) {
    console.error("Error fetching user gateways:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch gateways" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/payment-gateways
 * Create or update a gateway for the current user.
 * Body → { name: "razorpay" | "stripe", isEnabled?: boolean, credentials: { ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const body = await request.json();
    const { name, isEnabled = true, credentials = {} } = body;

    if (!name) {
      return NextResponse.json({ error: "Gateway name is required" }, { status: 400 });
    }

    // Validate gateway name is supported
    const allowedGateways = ["stripe", "razorpay"] as const;
    if (!allowedGateways.includes(name)) {
      return NextResponse.json(
        { error: `Unsupported gateway. Allowed values: ${allowedGateways.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate credentials structure based on gateway type
    if (typeof credentials !== "object" || credentials === null) {
      return NextResponse.json(
        { error: "Credentials must be an object" },
        { status: 400 }
      );
    }

    if (name === "razorpay") {
      const { apiKey, secretKey } = credentials as { apiKey?: string; secretKey?: string };
      if (!apiKey || !secretKey) {
        return NextResponse.json(
          { error: "Razorpay credentials must include 'apiKey' and 'secretKey'" },
          { status: 400 }
        );
      }
    }

    if (name === "stripe") {
      const { secretKey } = credentials as { secretKey?: string };
      if (!secretKey) {
        return NextResponse.json(
          { error: "Stripe credentials must include 'secretKey'" },
          { status: 400 }
        );
      }
    }

    // Encrypt sensitive credential fields before saving
    let encryptedCredentials: Record<string, any> = { ...credentials };
    if (name === "razorpay") {
      encryptedCredentials = {
        apiKey: encrypt(credentials.apiKey),
        secretKey: encrypt(credentials.secretKey),
      };
    }
    if (name === "stripe") {
      encryptedCredentials = {
        secretKey: encrypt(credentials.secretKey),
      };
    }

    // Upsert gateway owned by this user with same name
    const gateway = await PaymentGateway.findOneAndUpdate(
      { ownerId: session.user.id, name },
      { ownerId: session.user.id, name, isEnabled, credentials: encryptedCredentials },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, gateway });
  } catch (error: any) {
    console.error("Error saving user gateway:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save gateway" },
      { status: 500 }
    );
  }
} 