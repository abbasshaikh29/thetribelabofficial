import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import https from "https";
import crypto from "crypto";

// Create a more compatible HTTPS agent for R2
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Temporarily disable SSL verification
  keepAlive: true,
  timeout: 60000,
  maxSockets: 50,
});

// Initialize R2 client using S3-compatible API with compatible settings
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

/**
 * Generate a presigned URL for uploading a file to R2
 * @param fileName Original file name
 * @param fileType MIME type of the file
 * @param folder Folder path in R2 bucket
 * @returns Object with upload URL and the final R2 key
 */
export async function generateUploadUrl(
  fileName: string,
  fileType: string,
  folder: string = "uploads"
): Promise<{ uploadUrl: string; key: string }> {
  try {
    console.log(
      `Generating R2 upload URL for ${fileName} (${fileType}) in folder ${folder}`
    );

    // Create a unique file name to prevent overwriting
    const fileExtension = fileName.split(".").pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;

    // Create the R2 key (path)
    const key = `${folder}/${uniqueFileName}`;
    console.log(`Generated R2 key: ${key}`);

    // Create the command to put an object in R2
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType,
      ACL: "public-read", // This is crucial for public access
    });

    console.log(`Generating presigned URL with bucket: ${bucketName}`);

    // Generate a presigned URL for uploading
    const uploadUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 3600,
    }); // URL expires in 1 hour

    console.log(`Generated presigned URL: ${uploadUrl.substring(0, 100)}...`);

    return {
      uploadUrl,
      key,
    };
  } catch (error) {
    console.error("Error generating R2 upload URL:", error);
    throw error;
  }
}

/**
 * Generate a presigned URL for downloading/viewing a file from R2
 * @param key R2 object key
 * @returns Presigned URL for downloading/viewing
 */
export async function generateDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  // Generate a presigned URL for downloading
  const downloadUrl = await getSignedUrl(r2Client, command, {
    expiresIn: 3600,
  }); // URL expires in 1 hour

  return downloadUrl;
}

/**
 * Delete a file from R2
 * @param key R2 object key
 * @returns Success status
 */
export async function deleteFile(key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await r2Client.send(command);
    return true;
  } catch (error) {
    console.error("Error deleting file from R2:", error);
    return false;
  }
}

/**
 * Get the public URL for a file in R2
 * @param key R2 object key
 * @returns Public URL
 */
export function getPublicUrl(key: string): string {
  console.log("[R2] getPublicUrl called with key:", key);

  // If using Cloudflare R2 public URL
  if (process.env.NEXT_PUBLIC_R2_PUBLIC_URL) {
    const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
    console.log(
      "[R2] Using NEXT_PUBLIC_R2_PUBLIC_URL. Generated URL:",
      publicUrl
    );
    return publicUrl;
  }

  // If using custom domain
  if (process.env.NEXT_PUBLIC_CUSTOM_DOMAIN) {
    const publicUrl = `${process.env.NEXT_PUBLIC_CUSTOM_DOMAIN}/${key}`;
    console.log(
      "[R2] Using NEXT_PUBLIC_CUSTOM_DOMAIN. Generated URL:",
      publicUrl
    );
    return publicUrl;
  }

  // Hardcoded fallback for R2 public URL
  // The correct format for public R2 URLs is https://pub-{account-id}.r2.dev/{key}
  const fallbackUrl = `https://pub-895f71ea78c843b59c97073ccfe523c5.r2.dev/${key}`;
  console.log("[R2] Using fallback URL. Generated URL:", fallbackUrl);
  return fallbackUrl;
}

/**
 * Generate a path for course content
 * @param courseId Course ID
 * @param moduleId Optional module ID
 * @param lessonId Optional lesson ID
 * @returns Path string
 */
export function generateCoursePath(
  courseId: string,
  moduleId?: string,
  lessonId?: string
): string {
  let path = `courses/${courseId}`;
  if (moduleId) {
    path += `/modules/${moduleId}`;
    if (lessonId) {
      path += `/lessons/${lessonId}`;
    }
  }
  return path;
}
