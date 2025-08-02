import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";

// Temporary fallback upload endpoint for when R2 is unavailable
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = (formData.get("type") as string) || "profile";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // For now, return a placeholder response indicating the service is unavailable
    // In a production environment, you might want to:
    // 1. Store the file temporarily in a local directory
    // 2. Use a different cloud storage provider as backup
    // 3. Queue the upload for later processing
    
    console.log(`Fallback upload requested for file: ${file.name} (${file.type})`);
    
    return NextResponse.json({
      success: false,
      error: "Upload service temporarily unavailable",
      message: "The primary upload service (Cloudflare R2) is experiencing SSL connectivity issues. This is a known technical issue that our team is working to resolve.",
      suggestions: [
        "Please try again in a few minutes",
        "Contact support if the issue persists",
        "As a temporary workaround, you can use a direct URL to your image if you have one hosted elsewhere"
      ],
      technicalDetails: "SSL/TLS handshake failure with Cloudflare R2 endpoint",
      timestamp: new Date().toISOString(),
    }, { status: 503 });

  } catch (error: any) {
    console.error("Error in fallback upload:", error);
    return NextResponse.json(
      {
        error: "Fallback upload service error",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
