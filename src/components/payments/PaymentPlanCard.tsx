"use client";

import React from "react";
import { Check } from "lucide-react";
import RazorpayCheckout from "./RazorpayCheckout";
import PayNowButton from "./PayNowButton";

interface PaymentPlanProps {
  plan: {
    _id: string;
    name: string;
    description?: string;
    amount: number;
    currency: string;
    interval?: "one_time" | "monthly" | "yearly";
    intervalCount?: number;
    features?: string[];
    planType: "platform" | "community";
    communityId?: string;
  };
  isPopular?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

const PaymentPlanCard: React.FC<PaymentPlanProps> = ({
  plan,
  isPopular = false,
  onSuccess,
  onError,
}) => {
  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
    }).format(amount);
  };

  // Format interval
  const formatInterval = (interval?: string, count: number = 1) => {
    if (!interval || interval === "one_time") return "";
    
    if (interval === "monthly") {
      return count === 1 ? "/month" : `/${count} months`;
    }
    
    if (interval === "yearly") {
      return count === 1 ? "/year" : `/${count} years`;
    }
    
    return `/${interval}`;
  };

  return (
    <div
      className="card border hover:shadow-lg transition-all duration-300 overflow-hidden h-full"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: isPopular ? "var(--brand-primary)" : "var(--border-color)",
        boxShadow: "var(--shadow-md)"
      }}
    >
      {isPopular && (
        <div
          className="absolute top-0 left-0 w-full h-1 opacity-70"
          style={{ backgroundColor: "var(--brand-primary)" }}
        ></div>
      )}
      <div className="card-body p-8">
        <div className="flex justify-between items-start">
          <h3 className="card-title text-2xl font-bold text-halloween-orange">
            {plan.name}
          </h3>
          {isPopular && (
            <div className="badge badge-lg bg-halloween-orange/10 text-halloween-orange border-halloween-orange/20">
              Best Value
            </div>
          )}
        </div>
        
        {plan.description && (
          <p className="text-halloween-black/70 mt-2">{plan.description}</p>
        )}
        
        <div className="mt-4 mb-6">
          <span className="text-5xl font-bold text-halloween-black">
            {formatCurrency(plan.amount, plan.currency)}
          </span>
          <span className="text-halloween-black/70 ml-1">
            {formatInterval(plan.interval, plan.intervalCount)}
          </span>
        </div>
        
        {plan.features && plan.features.length > 0 && (
          <ul className="space-y-3 mb-6">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="w-5 h-5 mt-0.5 rounded-full bg-halloween-orange/10 flex items-center justify-center text-halloween-orange flex-shrink-0">
                  <Check className="w-3 h-3" />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}
        
        <div className="card-actions mt-auto">
          {plan.planType === "community" ? (
            <PayNowButton
              communityId={plan.communityId}
              buttonText={`Subscribe Now - ${formatCurrency(plan.amount, plan.currency)}${formatInterval(plan.interval, plan.intervalCount)}`}
              variant="primary"
              size="lg"
              showFeatures={true}
              context="billing"
              onSuccess={onSuccess}
              onError={onError}
            />
          ) : (
            <RazorpayCheckout
              amount={plan.amount}
              currency={plan.currency}
              planId={plan._id}
              paymentType={plan.planType}
              communityId={plan.communityId}
              buttonText="Subscribe Now"
              onSuccess={onSuccess}
              onError={onError}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentPlanCard;
