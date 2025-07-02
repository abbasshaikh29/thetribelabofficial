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

    const { email, password, username } = await request.json();
    if (!email || !password || !username) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
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

    const existinguser = await User.findOne({ email });
    if (existinguser) {
      return NextResponse.json(
        { error: "User already registered" },
        {
          status: 400,
        }
      );
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24); // Token expires in 24 hours

    // Create user with verification token
    await User.create({
      email,
      password,
      username,
      emailVerified: false, // User needs to verify email
      verificationToken,
      verificationTokenExpiry,
    });

    // Send verification email
    try {
      const emailResult = await sendVerificationEmail(
        email,
        verificationToken,
        username
      );
      console.log("Email verification result:", emailResult);

      // In development, automatically verify the email if configured
      if (
        process.env.NODE_ENV === "development" &&
        process.env.AUTO_VERIFY_EMAIL === "true"
      ) {
        console.log("Auto-verifying email in development mode");
        const user = await User.findOne({ email });
        if (user) {
          user.emailVerified = true;
          await user.save();
          console.log("Email auto-verified for:", email);
        }
      }

      // Handle provider-specific scenarios
      if (!emailResult.success) {
        // Resend rate limit or other errors
        if (
          emailResult.error === "429" ||
          emailResult.error === "rate_limit_exceeded"
        ) {
          console.warn(
            "Rate limit or 429 error when sending verification email:",
            emailResult.error
          );

          // In development, we can auto-verify for testing
          if (process.env.NODE_ENV === "development") {
            console.log(
              "Auto-verifying email in development mode due to Resend rate limits"
            );
            const user = await User.findOne({ email });
            if (user) {
              user.emailVerified = true;
              await user.save();
              console.log("Email auto-verified for:", email);
            }
          }
        }
        // Missing API key
        else if (emailResult.error === "MISSING_API_KEY") {
          console.error("Resend API key is not configured properly");

          // In development, auto-verify for testing
          if (process.env.NODE_ENV === "development") {
            console.log(
              "Auto-verifying email in development mode due to missing API key"
            );
            const user = await User.findOne({ email });
            if (user) {
              user.emailVerified = true;
              await user.save();
              console.log("Email auto-verified for:", email);
            }
          }
        }
        // Log any other errors
        else {
          console.error("Email sending error:", emailResult.error);

          // In development, auto-verify regardless of error
          if (process.env.NODE_ENV === "development") {
            console.log(
              "Auto-verifying email in development mode despite email error"
            );
            const user = await User.findOne({ email });
            if (user) {
              user.emailVerified = true;
              await user.save();
              console.log("Email auto-verified for:", email);
            }
          }
        }
      }
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Continue with registration even if email fails
    }

    return NextResponse.json(
      {
        message:
          "User registered successfully. Please check your email to verify your account.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        error: "Failed to register",
      },
      { status: 500 }
    );
  }
}
