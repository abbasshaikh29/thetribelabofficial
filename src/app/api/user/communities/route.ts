import { NextRequest, NextResponse } from "next/server";
import { dbconnect } from "@/lib/db";
import { Community, ICommunity } from "@/models/Community";
import { getServerSession } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbconnect();

    // Find all communities where the user is a member
    const communities = await Community.find({ members: session.user.id });

    // Map communities with user's role in each
    const userCommunities = communities.map((community: ICommunity) => {
      let role = "member";
      if (community.admin === session.user.id) {
        role = "admin";
      } else if (community.subAdmins?.includes(session.user.id)) {
        role = "sub-admin";
      }

      return {
        _id: community._id,
        name: community.name,
        slug: community.slug,
        iconImageUrl: community.iconImageUrl || "", // Ensure it's a string
        role,
      };
    });

    return NextResponse.json(userCommunities);
  } catch (error) {
    // Error handling
    return NextResponse.json(
      { error: "Failed to fetch user communities" },
      { status: 500 }
    );
  }
}
