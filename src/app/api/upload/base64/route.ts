import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-helpers";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

// Alternative upload method using base64 and local storage as fallback
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileData, fileName, fileType, uploadType = "profile" } = await request.json();

    if (!fileData || !fileName) {
      return NextResponse.json({ error: "Missing file data or name" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    // Convert base64 to buffer
    const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Validate file size (5MB limit)
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    // Create unique filename
    const fileExtension = fileName.split(".").pop() || "jpg";
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;

    // Determine upload directory
    let uploadDir = "uploads";
    if (uploadType === "profile") {
      uploadDir = `profiles/${session.user.id}`;
    }

    // Create upload directory in public folder
    const publicDir = join(process.cwd(), "public", "uploads", uploadDir);
    await mkdir(publicDir, { recursive: true });

    // Write file to public directory
    const filePath = join(publicDir, uniqueFileName);
    await writeFile(filePath, buffer);

    // Generate public URL
    const publicUrl = `/uploads/${uploadDir}/${uniqueFileName}`;

    console.log(`File uploaded successfully via base64 method: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      key: `${uploadDir}/${uniqueFileName}`,
      fileName: uniqueFileName,
      fileType,
      method: "base64-local",
      message: "File uploaded successfully using fallback method",
    });

  } catch (error: any) {
    console.error("Error in base64 upload:", error);
    return NextResponse.json(
      {
        error: "Failed to upload file using fallback method",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
