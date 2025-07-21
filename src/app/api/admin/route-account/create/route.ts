import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { dbconnect } from "@/lib/db";
import { RouteAccountManager, ICreateRouteAccountData } from "@/lib/route-account-manager";
import mongoose from "mongoose";
import { IBankDetails, IKycDetails } from "@/models/RouteAccount";

// POST /api/admin/route-account/create - Create Route account for admin
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    const { bankDetails, kycDetails, email, phone } = await request.json();

    // Validate required fields
    if (!bankDetails || !kycDetails || !email || !phone) {
      return NextResponse.json(
        { error: "Missing required fields: bankDetails, kycDetails, email, phone" },
        { status: 400 }
      );
    }

    // Validate bank details structure
    const requiredBankFields = ['accountNumber', 'ifscCode', 'accountHolderName'];
    for (const field of requiredBankFields) {
      if (!bankDetails[field]) {
        return NextResponse.json(
          { error: `Missing required bank detail: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate KYC details structure
    const requiredKycFields = ['panNumber', 'businessType'];
    for (const field of requiredKycFields) {
      if (!kycDetails[field]) {
        return NextResponse.json(
          { error: `Missing required KYC detail: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
      return NextResponse.json(
        { error: "Invalid phone number format. Please provide a 10-digit number." },
        { status: 400 }
      );
    }

    try {
      // Create Route account data
      const routeAccountData: ICreateRouteAccountData = {
        adminId: new mongoose.Types.ObjectId(session.user.id),
        bankDetails: bankDetails as IBankDetails,
        kycDetails: kycDetails as IKycDetails,
        email,
        phone: phone.replace(/\D/g, '') // Clean phone number
      };

      // Create Route account
      const routeAccount = await RouteAccountManager.createRouteAccount(routeAccountData);

      return NextResponse.json({
        success: true,
        message: "Route account created successfully",
        routeAccount: {
          id: routeAccount._id,
          status: routeAccount.status,
          kycStatus: routeAccount.kycStatus,
          routeAccountId: routeAccount.routeAccountId,
          createdAt: routeAccount.createdAt
        }
      });

    } catch (routeError: any) {
      console.error("Route account creation error:", routeError);
      
      // Handle specific error types
      if (routeError.message.includes('already exists')) {
        return NextResponse.json(
          { error: "Route account already exists for this admin" },
          { status: 409 }
        );
      }
      
      if (routeError.message.includes('Invalid')) {
        return NextResponse.json(
          { error: routeError.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: routeError.message || "Failed to create Route account" },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("Route account creation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
