"use client";

// Define the event types
export type RealtimeEvent = {
  type: string;
  data: any;
};

// Create a broadcast channel for real-time communication between tabs/windows
let broadcastChannel: BroadcastChannel | null = null;

// Initialize the broadcast channel
export function initRealtimeChannel() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    // Create a new broadcast channel
    broadcastChannel = new BroadcastChannel("app-realtime-channel");
    console.log("Realtime channel initialized");
    return broadcastChannel;
  } catch (error) {
    console.error("Error initializing realtime channel:", error);
    return null;
  }
}

// Get the broadcast channel
export function getRealtimeChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!broadcastChannel) {
    return initRealtimeChannel();
  }

  return broadcastChannel;
}

// Send an event to all other tabs/windows
export function sendRealtimeEvent(type: string, data: any) {
  const channel = getRealtimeChannel();
  if (!channel) {
    console.error("Realtime channel not available");
    return false;
  }

  try {
    const event: RealtimeEvent = { type, data };
    channel.postMessage(event);
    console.log(`Sent realtime event: ${type}`, data);
    return true;
  } catch (error) {
    console.error(`Error sending realtime event: ${type}`, error);
    return false;
  }
}

// Listen for events from other tabs/windows
export function listenForRealtimeEvents(
  eventType: string,
  callback: (data: any) => void
) {
  const channel = getRealtimeChannel();
  if (!channel) {
    console.error("Realtime channel not available");
    return () => {}; // Return empty cleanup function
  }

  const handleMessage = (event: MessageEvent<RealtimeEvent>) => {
    try {
      if (event.data && event.data.type === eventType) {
        callback(event.data.data);
      }
    } catch (error) {
      console.error(`Error handling realtime event ${eventType}:`, error);
    }
  };

  try {
    channel.addEventListener("message", handleMessage);
  } catch (error) {
    console.error(`Error adding event listener for ${eventType}:`, error);
    return () => {}; // Return empty cleanup function
  }

  // Return a cleanup function
  return () => {
    try {
      channel.removeEventListener("message", handleMessage);
    } catch (error) {
      console.error(`Error removing event listener for ${eventType}:`, error);
    }
  };
}

// Close the broadcast channel
export function closeRealtimeChannel() {
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
    console.log("Realtime channel closed");
  }
}
