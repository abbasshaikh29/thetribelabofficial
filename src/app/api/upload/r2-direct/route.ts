import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getServerSession } from "@/lib/auth-helpers";
import { v4 as uuidv4 } from "uuid";
import { getPublicUrl } from "@/lib/r2";
import https from "https";
import crypto from "crypto";

// Create a more compatible HTTPS agent for R2
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Temporarily disable SSL verification
  keepAlive: true,
  timeout: 60000,
  maxSockets: 50,
});

// Initialize R2 client with compatible settings
const r2Client = new S3Client({
  region: "auto", // R2 uses 'auto' for region
  endpoint: process.env.R2_ENDPOINT_URL || "", // Cloudflare R2 endpoint
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
  requestHandler: {
    httpOptions: {
      agent: httpsAgent,
      timeout: 60000,
    },
  },
  maxAttempts: 3,
});

const bucketName = process.env.R2_BUCKET_NAME || "";

// POST /api/upload/r2-direct - Upload a file directly to R2 from the server
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
    const communityId = formData.get("communityId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Determine the folder path based on the upload type
    let folder = "uploads";

    if (type === "profile") {
      folder = `profiles/${session.user.id}`;
    } else if (type === "community" && communityId) {
      folder = `communities/${communityId}`;
    } else if (type === "community-banner") {
      folder = communityId
        ? `communities/${communityId}/banners`
        : "communities/banners";
    } else if (type === "community-icon") {
      folder = communityId
        ? `communities/${communityId}/icons`
        : "communities/icons";
    } else if (type === "post-image") {
      folder = communityId
        ? `communities/${communityId}/posts/images`
        : `posts/images/${session.user.id}`;
    } else if (type === "message-image") {
      folder = `messages/images/${session.user.id}`;
    }

    // Create a unique filename
    const fileExtension = file.name.split(".").pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const key = `${folder}/${uniqueFileName}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`Uploading file to R2: ${key} (${file.type})`);

    // Upload to R2
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ACL: "public-read", // This is crucial for public access
      });

      await r2Client.send(command);
      console.log("File uploaded successfully to R2");
    } catch (uploadError: any) {
      console.error("Error uploading to R2:", uploadError);
      throw uploadError;
    }

    // Get the public URL
    const fileUrl = getPublicUrl(key);

    return NextResponse.json({
      success: true,
      url: fileUrl,
      key,
      fileName: file.name,
      fileType: file.type,
    });
  } catch (error: any) {
    console.error("Error uploading file:", error);

    // Provide more specific error messages based on error type
    let userMessage = "Failed to upload file";
    let statusCode = 500;

    if (error.code === "EPROTO" || error.message?.includes("SSL") || error.message?.includes("handshake")) {
      userMessage = "Upload service temporarily unavailable due to SSL configuration. Please try again later.";
      statusCode = 503; // Service Unavailable
    } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      userMessage = "Unable to connect to upload service. Please check your internet connection.";
      statusCode = 503;
    } else if (error.code === "ETIMEDOUT") {
      userMessage = "Upload request timed out. Please try again.";
      statusCode = 408; // Request Timeout
    }

    return NextResponse.json(
      {
        error: userMessage,
        message: error.message,
        code: error.code,
        technical: "SSL/TLS handshake failure with Cloudflare R2. This is a known issue with certain Node.js versions.",
      },
      { status: statusCode }
    );
  }
}
