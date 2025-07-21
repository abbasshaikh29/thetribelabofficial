import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { Community, ICommunity } from "@/models/Community";
import mongoose from "mongoose";

export async function GET(request: NextRequest) {
  try {
    await dbconnect();
    
    // Get the slug from the query parameters
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    
    if (!slug) {
      return NextResponse.json({ 
        error: "Slug parameter is required",
        allCommunities: [] 
      }, { status: 400 });
    }
    
    // Try to find the community by slug
    const community = await (Community as any).findOne({ slug });

    // Get all communities to check if any exist
    const allCommunities = await (Community as any).find({}).limit(10);
    
    // Check database connection
    const dbStatus = {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
      dbName: mongoose.connection.db?.databaseName || "unknown"
    };
    
    return NextResponse.json({
      dbStatus,
      communityFound: !!community,
      communityData: community ? {
        _id: community._id.toString(),
        name: community.name,
        slug: community.slug,
        members: community.members?.length || 0,
        adminQuestions: community.adminQuestions?.length || 0
      } : null,
      allCommunities: allCommunities.map((c: ICommunity) => ({
        _id: c._id?.toString() || '',
        name: c.name,
        slug: c.slug
      })),
      totalCommunities: allCommunities.length
    });
  } catch (error) {
    return NextResponse.json({ 
      error: "Failed to check community",
      errorMessage: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
