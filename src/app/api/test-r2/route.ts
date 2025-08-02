import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import https from "https";

// Create a more compatible HTTPS agent for R2
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Temporarily disable SSL verification
  keepAlive: true,
  timeout: 60000,
  maxSockets: 50,
});

// Initialize R2 client with compatible settings
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT_URL || "",
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

export async function GET() {
  try {
    // Test R2 configuration
    const configCheck = {
      hasEndpoint: !!process.env.R2_ENDPOINT_URL,
      hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
      hasBucketName: !!process.env.R2_BUCKET_NAME,
      hasPublicUrl: !!process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
      endpoint: process.env.R2_ENDPOINT_URL,
      bucketName: process.env.R2_BUCKET_NAME,
      publicUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
    };

    // Try to list objects in the bucket (limited to 1 for testing)
    let bucketAccessible = false;
    let bucketError = null;
    
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1,
      });
      
      const result = await r2Client.send(command);
      bucketAccessible = true;
      console.log("R2 bucket accessible, found", result.KeyCount, "objects");
    } catch (error) {
      bucketError = error instanceof Error ? error.message : String(error);
      console.error("R2 bucket access error:", bucketError);
    }

    return NextResponse.json({
      success: true,
      config: configCheck,
      bucketAccessible,
      bucketError,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("R2 test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
