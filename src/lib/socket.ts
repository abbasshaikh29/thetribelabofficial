import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";

// Declare the global io property
declare global {
  var io: SocketIOServer | null;
}

// Initialize Socket.io and attach it to our HTTP server
export function initSocketIO(httpServer: HttpServer) {
  // Don't re-initialize if already set up
  if (global.io) {
    console.log("Socket.io already initialized");
    return global.io;
  }

  try {
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXTAUTH_URL || "*",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    // Set up connection event handler
    io.on("connection", (socket) => {
      console.log(`Socket connected: ${socket.id}`);
      
      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });

    // Store io instance globally
    global.io = io;
    console.log("Socket.io initialized successfully");
    return io;
  } catch (error) {
    console.error("Failed to initialize Socket.io:", error);
    return null;
  }
}

// Function to get the Socket.io instance
export const getIO = () => {
  // In the browser, return null
  if (typeof window !== "undefined") {
    return null;
  }

  // In Node.js, return the global io instance
  return global.io || null;
};

// Function to emit an event to a room
export function emitToRoom(room: string, event: string, data: any) {
  const io = getIO();
  if (!io) {
    console.error("Socket.io not initialized");
    return false;
  }

  try {
    io.to(room).emit(event, data);
    console.log(`Emitted ${event} to room ${room}`);
    return true;
  } catch (error) {
    console.error(`Error emitting ${event} to room ${room}:`, error);
    return false;
  }
}

// Function to emit an event to all clients
export function emitToAll(event: string, data: any) {
  const io = getIO();
  if (!io) {
    console.error("Socket.io not initialized");
    return false;
  }

  try {
    io.emit(event, data);
    console.log(`Emitted ${event} to all clients`);
    return true;
  } catch (error) {
    console.error(`Error emitting ${event} to all clients:`, error);
    return false;
  }
}
