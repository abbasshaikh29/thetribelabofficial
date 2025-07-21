// Script to create MongoDB indexes for better performance
// Polyfill for Node.js compatibility
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize dotenv with the correct path to .env.local
dotenv.config({ path: resolve(__dirname, "../../.env.local") });

async function createIndexes() {
  try {
    // Check if MONGODB_URI is available
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);

    // Get the database connection
    const db = mongoose.connection;

    // Helper function to safely create an index
    async function safeCreateIndex(collection, keys, options) {
      try {
        await db.collection(collection).createIndex(keys, options);
        console.log(
          `Index created for ${collection} on ${JSON.stringify(keys)}`
        );
      } catch (error) {
        if (error.code === 86) {
          // IndexKeySpecsConflict
          console.log(
            `Index already exists for ${collection} on ${JSON.stringify(keys)}`
          );
        } else {
          console.error(
            `Error creating index for ${collection}:`,
            error.message
          );
        }
      }
    }

    // Create indexes for the Community collection

    await safeCreateIndex(
      "communities",
      { slug: 1 },
      { unique: true, sparse: true }
    );
    await safeCreateIndex("communities", { members: 1 }, {});
    await safeCreateIndex("communities", { admin: 1 }, {});
    await safeCreateIndex("communities", { subAdmins: 1 }, {});


    // Create indexes for the User collection

    await safeCreateIndex("users", { email: 1 }, { unique: true });
    await safeCreateIndex("users", { username: 1 }, { unique: true });


    // Create indexes for the Post collection

    await safeCreateIndex("posts", { communityId: 1, createdAt: -1 }, {});
    await safeCreateIndex("posts", { createdBy: 1 }, {});


    // Create indexes for the Comment collection

    await safeCreateIndex("comments", { postId: 1, createdAt: -1 }, {});
    await safeCreateIndex("comments", { author: 1 }, {});



  } catch (error) {
    console.error("Error creating indexes:", error);
  } finally {
    // Close the MongoDB connection
    await mongoose.disconnect();

  }
}

// Run the function
createIndexes();
