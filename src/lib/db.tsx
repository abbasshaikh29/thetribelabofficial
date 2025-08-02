import mongoose from "mongoose";

// Get the MongoDB URI from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

const isDevelopment = process.env.NODE_ENV === "development";
const isBuildTime = process.env.NEXT_PHASE === "phase-production-build";

// Only throw an error if we're not in the build phase and MongoDB URI is missing
if (!MONGODB_URI && !isBuildTime) {
  console.warn("MongoDB URI is not defined - database connections will fail");
}

// Define a type for our cached connection
type MongooseCache = {
  conn: mongoose.Connection | null;
  promise: Promise<mongoose.Connection> | null;
};

// Use a module-level variable instead of global
let cached: MongooseCache = { conn: null, promise: null };

export async function dbconnect() {
  // If we're in the build phase and no MongoDB URI is available, return a mock connection
  if (isBuildTime && !MONGODB_URI) {
    console.warn(
      "Build phase detected with no MongoDB URI - returning mock connection"
    );
    return {
      readyState: 0,
      models: {},
      on: () => {},
      once: () => {},
    } as unknown as mongoose.Connection;
  }

  // Return cached connection if available and still connected
  if (cached.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  // Check for MongoDB URI before attempting connection
  if (!MONGODB_URI) {
    throw new Error("Cannot connect to MongoDB: URI is not defined");
  }

  // Create a new connection if none exists or if the promise failed
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable mongoose buffering
      maxPoolSize: 15, // Increased pool size for better concurrency
      minPoolSize: 2, // Maintain minimum connections
      serverSelectionTimeoutMS: 8000, // Faster server selection
      socketTimeoutMS: 30000, // Reduced socket timeout
      connectTimeoutMS: 8000, // Faster connection timeout
      maxIdleTimeMS: 20000, // Reduced idle time
      retryWrites: true,
      authSource: "admin", // Specify auth source
      heartbeatFrequencyMS: 10000, // More frequent heartbeats
      // Removed deprecated options: useNewUrlParser, useUnifiedTopology
    };

    console.log("Attempting to connect to MongoDB...");
    console.log(
      "MongoDB URI pattern:",
      MONGODB_URI.replace(/:\/\/[^@]+@/, "://***:***@")
    );

    try {
      cached.promise = mongoose
        .connect(MONGODB_URI, opts)
        .then(() => {
          console.log("MongoDB connected successfully");
          return mongoose.connection;
        })
        .catch((error) => {
          console.error("MongoDB connection error:", error.message);

          // Provide specific error messages for common issues
          if (error.message.includes("ECONNREFUSED")) {
            console.error("TROUBLESHOOTING GUIDE:");
            console.error(
              "1. Check if MongoDB Atlas cluster is active (not paused)"
            );
            console.error("2. Verify Network Access settings in MongoDB Atlas");
            console.error(
              "3. Add your IP address (0.0.0.0/0 for development) to the IP Access List"
            );
            console.error("4. Ensure cluster is in the correct region");
          }

          if (error.message.includes("authentication failed")) {
            console.error(
              "Authentication issue - check username/password in connection string"
            );
          }

          // Reset promise on failure so we can retry
          cached.promise = null;
          throw new Error(`Failed to connect to MongoDB: ${error.message}`);
        });
    } catch (error: any) {
      console.error("Error in mongoose.connect:", error);
      // Reset promise on failure so we can retry
      cached.promise = null;
      throw new Error(`Failed to connect to MongoDB: ${error.message}`);
    }
  }

  try {
    cached.conn = await cached.promise;

    // Set up connection event listeners
    if (cached.conn) {
      cached.conn.on("disconnected", () => {
        console.warn("MongoDB disconnected");
        cached.conn = null;
        cached.promise = null;
      });

      cached.conn.on("error", (error) => {
        console.error("MongoDB connection error:", error);
        cached.conn = null;
        cached.promise = null;
      });

      cached.conn.on("reconnected", () => {
        console.log("MongoDB reconnected");
      });
    }
  } catch (error) {
    console.error("Error resolving MongoDB connection:", error);
    // Reset both promise and connection on failure
    cached.promise = null;
    cached.conn = null;
    throw new Error(`Failed to resolve MongoDB connection: ${error}`);
  }

  return cached.conn;
}
