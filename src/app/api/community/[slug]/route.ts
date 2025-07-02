import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import mongoose from "mongoose";

interface CommunityType {
  _id: string;
  name: string;
  description?: string;
  slug: string;
  bannerImageurl?: string;
  iconImageUrl?: string;
  members: string[];
  admin: string;
  subAdmins?: string[];
  adminQuestions?: string[];
  joinRequests?: {
    userId: string;
    status: "pending" | "approved" | "rejected";
    answers: string[];
    createdAt: Date;
  }[];
  isPrivate?: boolean;
  price?: number;
  currency?: string;
  paymentEnabled?: boolean;
  subscriptionRequired?: boolean;
  adminTrialInfo?: {
    activated: boolean;
    startDate?: Date;
    endDate?: Date;
  };
  paymentStatus?: string;
  subscriptionEndDate?: Date;
  freeTrialActivated?: boolean;
}

// In Next.js 15, the params object is a Promise
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const { slug } = resolvedParams;

    // Add cache control headers to prevent caching
    const headers = new Headers({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    if (!slug) {
      return NextResponse.json(
        { error: "Invalid slug parameter" },
        { status: 400, headers }
      );
    }

    await dbconnect();

    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      return NextResponse.json(
        {
          error: "Database connection not ready",
          details: { readyState: mongoose.connection.readyState },
        },
        { status: 500, headers }
      );
    }

    // Optimized query:
    // 1. Use lean() to get a plain JavaScript object instead of a Mongoose document
    // 2. Only select the fields we need
    // 3. Add proper indexing hint
    const communityDoc = await Community.findOne({
      slug,
    })
      .select(
        "_id name slug description bannerImageurl iconImageUrl members admin subAdmins adminQuestions isPrivate price currency paymentEnabled subscriptionRequired adminTrialInfo paymentStatus subscriptionEndDate freeTrialActivated joinRequests"
      )
      .lean<{
        _id: mongoose.Types.ObjectId;
        name: string;
        slug?: string;
        description?: string;
        bannerImageurl?: string;
        iconImageUrl?: string;
        members: string[];
        admin: string;
        subAdmins?: string[];
        adminQuestions?: string[];
        joinRequests?: {
          userId: string;
          status: "pending" | "approved" | "rejected";
          answers: string[];
          createdAt: Date;
        }[];
        isPrivate?: boolean;
        price?: number;
        currency?: string;
        paymentEnabled?: boolean;
        subscriptionRequired?: boolean;
        adminTrialInfo?: {
          activated: boolean;
          startDate?: Date;
          endDate?: Date;
        };
        paymentStatus?: string;
        subscriptionEndDate?: Date;
        freeTrialActivated?: boolean;
      }>()
      .hint({ slug: 1 }); // Use the slug index for better performance

    // Check if we have a valid document
    if (!communityDoc) {
      // No community found
      const communityCount = await Community.countDocuments({});
      return NextResponse.json(
        {
          error: "Community not found",
          details: {
            slug,
            communityCount,
            databaseName: mongoose.connection.db?.databaseName || "unknown",
          },
        },
        { status: 404, headers }
      );
    }

    // We know communityDoc exists and is a valid document at this point
    // Convert to our CommunityType
    const community: CommunityType = {
      _id: communityDoc._id.toString(),
      name: communityDoc.name,
      slug: communityDoc.slug || "",
      description: communityDoc.description,
      bannerImageurl: communityDoc.bannerImageurl,
      iconImageUrl: communityDoc.iconImageUrl,
      members: communityDoc.members || [],
      admin: communityDoc.admin || "",
      subAdmins: communityDoc.subAdmins || [],
      adminQuestions: communityDoc.adminQuestions || [],
      joinRequests: communityDoc.joinRequests || [],
      isPrivate:
        communityDoc.isPrivate !== undefined ? communityDoc.isPrivate : true,
      price: communityDoc.price || 0,
      currency: communityDoc.currency || "USD",
      paymentEnabled: communityDoc.paymentEnabled || false,
      subscriptionRequired: communityDoc.subscriptionRequired || false,
      adminTrialInfo: communityDoc.adminTrialInfo,
      paymentStatus: communityDoc.paymentStatus,
      subscriptionEndDate: communityDoc.subscriptionEndDate,
      freeTrialActivated: communityDoc.freeTrialActivated,
    };

    // Community found, continue with processing

    // Validate the icon URL
    let iconImageUrl = community.iconImageUrl || "";
    if (iconImageUrl && iconImageUrl.trim() !== "") {
      try {
        // Validate URL format
        new URL(iconImageUrl);
      } catch (e) {
        // Invalid URL format, reset to empty string
        iconImageUrl = "";
      }
    }

    // Make sure iconImageUrl is explicitly set
    const responseData = {
      ...community,
      iconImageUrl,
      timestamp: Date.now(),
    };

    return NextResponse.json(responseData, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch community",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
