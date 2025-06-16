import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { User } from "../models/User";
import { dbconnect } from "./db";
import bcrypt from "bcryptjs";
import type { JWT } from "next-auth/jwt";
import { convertS3UrlToR2, isS3Url } from "@/utils/s3-to-r2-migration";

// Environment variable validation
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn(
    "Warning: Google OAuth credentials missing in environment variables"
  );
}

if (!process.env.NEXTAUTH_SECRET) {
  console.warn("Warning: NEXTAUTH_SECRET is missing in environment variables");
}

export const authOptions: NextAuthConfig = {
  trustHost: true,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("Attempting login with credentials:", credentials);
        if (!credentials?.email || !credentials?.password) {
          console.log("Missing credentials");
          return null;
        }
        try {
          await dbconnect();
          const user = await User.findOne({ email: credentials.email });
          console.log("User found:", user);
          if (!user) {
            console.log("User not found");
            return null;
          }
          console.log("User password from DB:", user.password);
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.password as string
          );
          console.log("Password valid:", isValid);
          if (!isValid) {
            console.log("Invalid password");
            return null;
          }
          if (user.emailVerified === false && user.provider !== "google") {
            console.log("Email not verified");
            throw new Error("Please verify your email before logging in");
          }
          return {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
            name: user.name || user.username,
            image: user.profileImage,
            profileImage: user.profileImage,
            emailVerified: user.emailVerified,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id as string;
        token.email = user.email as string;
        token.name = user.name as string;
        token.picture = user.image as string;
        token.username = user.username as string;

        // Add profileImage to token
        if (user.profileImage) {
          token.profileImage = user.profileImage;
        }
      }
      if (account) {
        token.provider = account.provider;
      }

      // Always check the database for the most up-to-date profile image
      if (token.id) {
        try {
          await dbconnect();
          const dbUser = await User.findById(token.id);

          if (dbUser?.profileImage) {
            // Check if the profile image is from S3 (user uploaded) or Google
            const isDbS3Image =
              dbUser.profileImage.includes(".amazonaws.com") ||
              (dbUser.profileImage.includes(".s3.") &&
                dbUser.profileImage.includes(".amazonaws.com"));

            const isDbGoogleImage = dbUser.profileImage.includes(
              "googleusercontent.com"
            );

            // If the user has uploaded their own profile image (S3), always use that
            if (isDbS3Image) {
              // Convert S3 URL to R2 URL
              const r2Url = convertS3UrlToR2(dbUser.profileImage);
              token.profileImage = r2Url;
            }
            // If the user hasn't uploaded their own image but has a Google image, use that as fallback
            else if (isDbGoogleImage && !token.profileImage) {
              token.profileImage = dbUser.profileImage;
            }
          }
        } catch (error) {
          // Silent error handling
        }
      }

      return token;
    },
    // Using any for session type to match Auth.js v5 structure
    async session({ session, token }: { session: any; token: JWT }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        session.user.username = token.username as string;
        session.user.provider = token.provider as string;

        // Add profileImage to session
        if (token.profileImage) {
          session.user.profileImage = token.profileImage as string;
        } else {
          // Try to get profileImage from database as a fallback
          try {
            await dbconnect();
            const dbUser = await User.findById(token.id);

            if (dbUser?.profileImage) {
              // Check if the profile image is from S3 (user uploaded) or Google
              const isDbS3Image =
                dbUser.profileImage.includes(".amazonaws.com") ||
                (dbUser.profileImage.includes(".s3.") &&
                  dbUser.profileImage.includes(".amazonaws.com"));

              const isDbGoogleImage = dbUser.profileImage.includes(
                "googleusercontent.com"
              );

              // If the user has uploaded their own profile image (S3), always use that
              if (isDbS3Image) {
                // Convert S3 URL to R2 URL
                const r2Url = convertS3UrlToR2(dbUser.profileImage);
                session.user.profileImage = r2Url;
              }
              // If the user hasn't uploaded their own image but has a Google image, use that as fallback
              else if (isDbGoogleImage && !session.user.profileImage) {
                session.user.profileImage = dbUser.profileImage;
              }
            }
          } catch (error) {
            // Silent error handling
          }
        }
      }

      return session;
    },
    async signIn({ user, account }) {
      try {
        await dbconnect();

        if (account?.provider === "google") {
          // Check if user exists
          let dbUser = await User.findOne({ email: user.email });

          if (!dbUser) {
            // Create new user if doesn't exist
            const username = user.name || user.email!.split("@")[0];
            dbUser = await User.create({
              email: user.email,
              username: username,
              name: user.name,
              profileImage: user.image,
              provider: "google",
              emailVerified: true, // Google users are automatically verified
              password: bcrypt.hashSync(
                Math.random().toString(36).slice(-8),
                10
              ),
            });
          } else {
            // For existing users, only update Google-specific information
            const updateFields: any = {
              name: user.name,
              provider: "google",
            };

            // Check if the user has an S3 profile image
            const hasS3Image =
              dbUser.profileImage &&
              (dbUser.profileImage.includes(".amazonaws.com") ||
                (dbUser.profileImage.includes(".s3.") &&
                  dbUser.profileImage.includes(".amazonaws.com")));

            // Only update the profile image if:
            // 1. The user doesn't have a profile image at all, or
            // 2. The user only has a Google profile image (not an S3 image)
            if (
              !dbUser.profileImage ||
              (!hasS3Image &&
                dbUser.profileImage.includes("googleusercontent.com"))
            ) {
              updateFields.profileImage = user.image;
            }

            await User.findOneAndUpdate(
              { email: user.email },
              { $set: updateFields },
              { new: true }
            );
          }

          // Update user object with database ID and username
          user.id = dbUser._id.toString();
          user.username = dbUser.username;
        }

        return true;
      } catch (error) {
        // Silent error handling in production
        if (process.env.NODE_ENV !== "production") {
          // Only log in development
          console.error("SignIn error:", error);
        }
        return false;
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours instead of 24
    updateAge: 2 * 60 * 60, // Update session every 2 hours
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain: undefined, // Let the browser set the domain automatically
      },
    },
    callbackUrl: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.callback-url"
          : "next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Host-next-auth.csrf-token"
          : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  debug: process.env.NODE_ENV !== "production",
  secret: process.env.NEXTAUTH_SECRET,
};
