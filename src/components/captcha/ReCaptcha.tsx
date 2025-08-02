"use client";

import { useState, useRef, useEffect } from "react";
import ReCAPTCHA from "react-google-recaptcha";

interface ReCaptchaProps {
  onVerify: (token: string | null) => void;
  onExpire?: () => void;
  siteKey?: string;
}

export default function ReCaptchaComponent({
  onVerify,
  onExpire,
  siteKey,
}: ReCaptchaProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  
  // Use the provided site key or fall back to the environment variable
  const captchaSiteKey = siteKey || process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

  useEffect(() => {
    console.log("ReCaptcha component loaded");
    console.log("Site key:", captchaSiteKey ? `${captchaSiteKey.substring(0, 10)}...` : "MISSING");
    console.log("Environment:", process.env.NODE_ENV);
    setIsLoaded(true);
  }, [captchaSiteKey]);

  const handleChange = (token: string | null) => {
    onVerify(token);
  };

  const handleExpired = () => {
    if (onExpire) {
      onExpire();
    }
    onVerify(null);
  };

  if (!isLoaded) {
    return <div className="h-[78px] w-full bg-gray-100 animate-pulse rounded"></div>;
  }

  if (!captchaSiteKey || captchaSiteKey === "YOUR_NEW_SITE_KEY_HERE") {
    console.error("ReCAPTCHA site key is missing or placeholder");

    // Development bypass - auto-verify in development mode
    if (process.env.NODE_ENV === "development") {
      return (
        <div className="text-warning text-sm p-2 border border-warning rounded bg-yellow-50">
          <div className="mb-2">⚠️ ReCAPTCHA is disabled in development mode</div>
          <button
            type="button"
            onClick={() => onVerify("dev-bypass-token")}
            className="btn btn-sm btn-warning"
          >
            Bypass ReCAPTCHA (Development Only)
          </button>
          <div className="text-xs mt-1">
            Please configure proper ReCAPTCHA keys for production
          </div>
        </div>
      );
    }

    return (
      <div className="text-error text-sm p-2 border border-error rounded">
        ReCAPTCHA configuration error. Site key is missing. Please contact the administrator.
      </div>
    );
  }

  // Add error handling for invalid key type
  const handleError = () => {
    console.error("ReCAPTCHA error occurred - likely invalid key type or domain mismatch");
  };

  return (
    <div className="flex justify-center my-4">
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={captchaSiteKey}
        onChange={handleChange}
        onExpired={handleExpired}
        onError={handleError}
        size="normal"
        theme="light"
      />
    </div>
  );
}
