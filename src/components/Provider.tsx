"use client";

import { SessionProvider } from "next-auth/react";
import { NotificationProvider } from "./Notification";
import { RealtimeProvider } from "./RealtimeProvider";

import SettingsModalProvider from "./modals/SettingsModalProvider";
import { useState, useEffect } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [storageConfig, setStorageConfig] = useState({
    configured: false,
    provider: "",
  });

  // Check if Cloudflare R2 is configured
  useEffect(() => {
    const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    const customDomain = process.env.NEXT_PUBLIC_CUSTOM_DOMAIN;

    if (r2Url || customDomain) {
      setStorageConfig({
        configured: true,
        provider: "Cloudflare R2",
      });
    }
  }, []);

  return (
    <SessionProvider
      refetchInterval={5 * 60} // Back to 5 minutes (300 seconds)
      refetchOnWindowFocus={true}
      refetchWhenOffline={false}
    >
      <NotificationProvider>
        <RealtimeProvider>
            <SettingsModalProvider>
              {children}
              {!storageConfig.configured && (
                <div className="fixed bottom-4 left-4 bg-yellow-100 text-yellow-800 p-2 rounded text-xs">
                  Storage not configured
                </div>
              )}
              {storageConfig.configured && (
                <div className="fixed bottom-4 left-4 bg-green-100 text-green-800 p-2 rounded text-xs">
                  Using {storageConfig.provider}
                </div>
              )}
            </SettingsModalProvider>
          </RealtimeProvider>
      </NotificationProvider>
    </SessionProvider>
  );
}
