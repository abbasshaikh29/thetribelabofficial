import { NextRequest, NextResponse } from "next/server";
import { User } from "@/models/User";
import { dbconnect } from "@/lib/db";
import { generateVerificationToken, sendVerificationEmail } from "@/lib/resend";

export async function POST(request: NextRequest) {
  try {
    // Check if we're in the build phase
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.log("Build phase detected - skipping database operations");
      return NextResponse.json(
        { message: "Build phase - operation skipped" },
        { status: 200 }
      );
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if MongoDB URI is available
    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      );
    }

    try {
      await dbconnect();
    } catch (dbError) {
      console.error("Database connection error:", dbError);
      return NextResponse.json(
        { error: "Failed to connect to database" },
        { status: 503 }
      );
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal that the user doesn't exist for security reasons
      return NextResponse.json(
        {
          message:
            "If your email exists in our system, a verification link has been sent.",
        },
        { status: 200 }
      );
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email is already verified" },
        { status: 400 }
      );
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24);

    // Update user with new token
    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    await user.save();

    // Send verification email
    const emailResult = await sendVerificationEmail(
      email,
      verificationToken,
      user.username
    );

    if (!emailResult.success) {
      console.error(
        "Failed to send verification email:",
        emailResult.error
      );

      // In development, we can still return success
      if (process.env.NODE_ENV === "development") {
        console.log(
          "Development mode: returning success despite email failure"
        );
        return NextResponse.json(
          {
            message:
              "Verification email would have been sent (development mode)",
            devMode: true,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: "Failed to send verification email. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Verification email has been sent" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Failed to resend verification email" },
      { status: 500 }
    );
  }
}
