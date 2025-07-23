"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Zap } from "lucide-react";
import { CommunitySubscriptionCheckout } from "@/components/payments/RazorpayCheckout";

interface PayNowButtonProps {
  communityId?: string;
  communitySlug?: string;
  buttonText?: string;
  variant?: "primary" | "secondary" | "urgent" | "minimal";
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showFeatures?: boolean;
  className?: string;
  onSuccess?: (subscription: any) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  // Context for where the button is used
  context?: "billing" | "trial_reminder" | "suspension" | "settings";
}

export default function PayNowButton({
  communityId,
  communitySlug,
  buttonText = "Subscribe Now ($29/month)",
  variant = "primary",
  size = "md",
  showIcon = true,
  showFeatures = false,
  className = "",
  onSuccess,
  onError,
  disabled = false,
  context = "billing",
}: PayNowButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const getVariantStyles = () => {
    switch (variant) {
      case "urgent":
        return {
          button: "shadow-lg transition-colors duration-200",
          icon: "",
          style: {
            backgroundColor: "var(--brand-error)",
            color: "var(--primary-content)",
            borderColor: "var(--brand-error)",
          },
        };
      case "secondary":
        return {
          button: "transition-colors duration-200",
          icon: "",
          style: {
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-primary)",
            borderColor: "var(--border-color)",
          },
        };
      case "minimal":
        return {
          button: "bg-transparent transition-colors duration-200",
          icon: "",
          style: {
            color: "var(--brand-primary)",
            borderColor: "var(--brand-primary)",
          },
        };
      default: // primary
        return {
          button: "transition-colors duration-200",
          icon: "",
          style: {
            backgroundColor: "var(--brand-primary)",
            color: "var(--primary-content)",
            borderColor: "var(--brand-primary)",
          },
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return "px-3 py-1.5 text-sm";
      case "lg":
        return "px-8 py-4 text-lg";
      default: // md
        return "px-6 py-3 text-base";
    }
  };

  const styles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const handleSuccess = (subscription: any) => {
    setIsProcessing(false);
    onSuccess?.(subscription);

    // Redirect to community with success message
    if (communitySlug) {
      router.push(
        `/Newcompage/${communitySlug}?subscription=activated&trial=converted`
      );
    } else if (communityId) {
      router.push(
        `/Newcompage/${communityId}?subscription=activated&trial=converted`
      );
    }
  };

  const handleError = (error: string) => {
    setIsProcessing(false);
    onError?.(error);
  };

  const handleProcessingStart = () => {
    setIsProcessing(true);
  };

  if (!session?.user) {
    return (
      <button
        type="button"
        onClick={() => router.push("/auth/signin")}
        className={`${styles.button} ${sizeStyles} border rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${className}`}
        style={styles.style}
        disabled={disabled}
      >
        {showIcon && <CreditCard className={`w-4 h-4 ${styles.icon}`} />}
        <span>Sign In to Subscribe</span>
      </button>
    );
  }

  return (
    <div className={className}>
      <CommunitySubscriptionCheckout
        communityId={communityId}
        communitySlug={communitySlug}
        buttonText={buttonText}
        onSuccess={handleSuccess}
        onError={handleError}
        onStart={handleProcessingStart}
        className={`${styles.button} ${sizeStyles} border rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 w-full ${
          disabled || isProcessing ? "opacity-50 cursor-not-allowed" : ""
        }`}
        disabled={disabled || isProcessing}
        customButton={({
          isLoading: _isLoading,
          isScriptLoaded: _isScriptLoaded,
          buttonText: _btnText,
          ...buttonProps
        }) => (
          <button
            {...buttonProps}
            type="button"
            className={`${styles.button} ${sizeStyles} border rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 w-full ${
              disabled || isProcessing ? "opacity-50 cursor-not-allowed" : ""
            }`}
            style={styles.style}
            disabled={disabled || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                {showIcon &&
                  (variant === "urgent" ? (
                    <Zap className={`w-4 h-4 ${styles.icon}`} />
                  ) : (
                    <CreditCard className={`w-4 h-4 ${styles.icon}`} />
                  ))}
                <span>{_btnText}</span>
              </>
            )}
          </button>
        )}
      />

      {showFeatures && (
        <div
          className="mt-3 text-xs space-y-1"
          style={{ color: "var(--text-secondary)" }}
        >
          <div className="flex items-center justify-center space-x-4">
            <span>✓ Unlimited features</span>
            <span>✓ Cancel anytime</span>
            <span>✓ No setup fees</span>
          </div>
          <p className="text-center">
            Secure payment • No refunds after activation
          </p>
        </div>
      )}

      {/* Context-specific messaging */}
      {context === "trial_reminder" && (
        <p
          className="mt-2 text-xs text-center font-medium"
          style={{ color: "var(--brand-warning)" }}
        >
          Subscribe now to avoid community suspension
        </p>
      )}

      {context === "suspension" && (
        <p
          className="mt-2 text-xs text-center font-medium"
          style={{ color: "var(--brand-error)" }}
        >
          Your community is currently suspended - Subscribe to reactivate
        </p>
      )}

      {context === "settings" && (
        <p
          className="mt-2 text-xs text-center"
          style={{ color: "var(--text-secondary)" }}
        >
          Upgrade to unlock all premium features
        </p>
      )}
    </div>
  );
}

// Specialized variants for common use cases
export function UrgentPayNowButton(props: Omit<PayNowButtonProps, "variant">) {
  return (
    <PayNowButton
      {...props}
      variant="urgent"
      buttonText={props.buttonText || "Subscribe Now - Avoid Suspension"}
    />
  );
}

export function MinimalPayNowButton(
  props: Omit<PayNowButtonProps, "variant" | "showIcon">
) {
  return (
    <PayNowButton
      {...props}
      variant="minimal"
      showIcon={false}
      buttonText={props.buttonText || "Upgrade to Pro"}
    />
  );
}

export function LargePayNowButton(
  props: Omit<PayNowButtonProps, "size" | "showFeatures">
) {
  return (
    <PayNowButton
      {...props}
      size="lg"
      showFeatures={true}
      buttonText={props.buttonText || "Start Your Subscription - $29/month"}
    />
  );
}

// Trial conversion specific button
export function TrialConversionButton({
  daysRemaining,
  ...props
}: PayNowButtonProps & { daysRemaining?: number }) {
  const getButtonText = () => {
    if (daysRemaining === null || daysRemaining === undefined) {
      return "Convert Trial to Subscription";
    }
    if (daysRemaining === 0) {
      return "Subscribe Now - Trial Expires Today!";
    }
    if (daysRemaining === 1) {
      return "Subscribe Now - Trial Expires Tomorrow!";
    }
    if (daysRemaining <= 3) {
      return `Subscribe Now - ${daysRemaining} Days Left`;
    }
    return "Convert to Paid Subscription";
  };

  const getVariant = (): PayNowButtonProps["variant"] => {
    if (daysRemaining === null || daysRemaining === undefined) return "primary";
    if (daysRemaining <= 2) return "urgent";
    return "primary";
  };

  return (
    <PayNowButton
      {...props}
      variant={getVariant()}
      buttonText={getButtonText()}
      showFeatures={true}
    />
  );
}
