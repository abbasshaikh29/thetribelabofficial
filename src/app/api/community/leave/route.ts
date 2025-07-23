import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { Community } from "@/models/Community";
import { getServerSession } from "@/lib/auth-helpers";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { communityId } = await request.json();
    
    if (!communityId) {
      return NextResponse.json(
        { error: "Community ID is required" },
        { status: 400 }
      );
    }

    await dbconnect();

    // Find the community
    const community = await (Community as any).findById(communityId);
    if (!community) {
      return NextResponse.json(
        { error: "Community not found" },
        { status: 404 }
      );
    }

    // Check if user is a member
    if (!community.members.includes(session.user.id)) {
      return NextResponse.json(
        { error: "You are not a member of this community" },
        { status: 400 }
      );
    }

    // Check if user is the admin - admins can't leave their own community
    if (community.admin === session.user.id) {
      return NextResponse.json(
        { error: "Admins cannot leave their own community. Transfer ownership first or delete the community." },
        { status: 400 }
      );
    }

    // Remove user from members array
    community.members = community.members.filter(
      (memberId: string) => memberId !== session.user.id
    );

    // If user is a sub-admin, remove from sub-admins array
    if (community.subAdmins?.includes(session.user.id)) {
      community.subAdmins = community.subAdmins.filter(
        (id: string) => id !== session.user.id
      );
    }

    await community.save();

    return NextResponse.json({ 
      success: true,
      message: "You have successfully left the community" 
    });
  } catch (error) {
    console.error("Error leaving community:", error);
    return NextResponse.json(
      { error: "Failed to leave community" },
      { status: 500 }
    );
  }
}
