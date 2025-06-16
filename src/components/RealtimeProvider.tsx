"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useSession } from "next-auth/react";
import { initRealtimeChannel, closeRealtimeChannel } from "@/lib/realtime";

// Define the context type
interface RealtimeContextType {
  isEnabled: boolean;
}

// Create the context with default values
const RealtimeContext = createContext<RealtimeContextType>({
  isEnabled: false,
});

// Custom hook to use the realtime context
export const useRealtime = () => useContext(RealtimeContext);

// Provider component
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = React.useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    // Only initialize realtime if user is authenticated
    if (!session?.user) {
      setIsEnabled(false);
      return;
    }

    let mounted = true;

    try {
      // Initialize the realtime channel
      const channel = initRealtimeChannel();
      if (channel && mounted) {
        setIsEnabled(true);
        console.log("Realtime communication enabled");
      } else if (mounted) {
        setIsEnabled(false);
      }
    } catch (error) {
      console.error("Error initializing realtime:", error);
      if (mounted) {
        setIsEnabled(false);
      }
    }

    // Clean up on unmount
    return () => {
      mounted = false;
      try {
        closeRealtimeChannel();
        setIsEnabled(false);
      } catch (error) {
        console.error("Error cleaning up realtime:", error);
      }
    };
  }, [session?.user]);

  return (
    <RealtimeContext.Provider value={{ isEnabled }}>
      {children}
    </RealtimeContext.Provider>
  );
}
