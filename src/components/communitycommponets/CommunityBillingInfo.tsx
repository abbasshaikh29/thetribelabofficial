"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle, Clock, Calendar, CreditCard, X, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/api-client";
import RazorpayCheckout from "@/components/payments/RazorpayCheckout";
import { useSettingsModal } from "@/components/modals/SettingsModalProvider";
import { useCommunityBilling } from "@/contexts/CommunityBillingContext";
import TrialReminderBanner from "@/components/trial/TrialReminderBanner";
import PayNowButton, { TrialConversionButton } from "@/components/payments/PayNowButton";


export default function CommunityBillingInfo() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { closeModals } = useSettingsModal();
  const {
    billingData: billingInfo,
    loading,
    error: contextError,
    refreshing,
    refreshBillingData,
    updateBillingData,
    daysRemaining,
    trialActive,
    subscriptionActive,
    percentRemaining
  } = useCommunityBilling();
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);
  const [cancellingTrial, setCancellingTrial] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [initializingPlans, setInitializingPlans] = useState(false);
  const [availablePlan, setAvailablePlan] = useState<any>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const fetchAvailablePlans = async () => {
    try {
      // First, ensure a default plan exists
      await fetch('/api/community-subscription-plans/ensure-default', { method: 'POST' });

      // Then fetch available plans
      const response = await fetch('/api/community-subscription-plans?isActive=true');
      if (response.ok) {
        const data = await response.json();
        if (data.plans && data.plans.length > 0) {
          // Use the first available monthly plan, or any plan if no monthly plan exists
          const monthlyPlan = data.plans.find((plan: any) => plan.interval === 'monthly');
          setAvailablePlan(monthlyPlan || data.plans[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching available plans:", err);
    }
  };

  useEffect(() => {
    if (slug && session?.user?.id) {
      fetchAvailablePlans();
    }
  }, [slug, session?.user?.id]);

  // Direct trial activation function for troubleshooting
  const activateTrialDirectly = async () => {
    if (!slug || !session?.user?.id) return;
    
    try {
      setActivatingTrial(true);
      setLocalError(null);
      
      // Call the new direct trial activation endpoint
      const response = await fetch(`/api/community/${slug}/activate-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to activate trial');
      }
      
      const data = await response.json();
      console.log('Trial activation response:', data);
      
      // Set success state
      setActivationSuccess(true);
      
      // Update the billing info without refreshing the page
      if (data.community) {
        updateBillingData({
          _id: data.community._id,
          adminTrialInfo: data.community.adminTrialInfo,
          paymentStatus: data.community.paymentStatus,
          subscriptionEndDate: data.community.subscriptionEndDate,
          freeTrialActivated: data.community.freeTrialActivated
        });
      }
    } catch (err) {
      console.error('Error activating trial directly:', err);
      setLocalError(err instanceof Error ? err.message : 'Failed to activate trial');
    } finally {
      setActivatingTrial(false);
    }
  };
  
  // Function to cancel the trial
  const cancelTrial = async () => {
    if (!slug || !session?.user?.id) return;
    
    if (!confirm("Are you sure you want to cancel your trial? This will immediately suspend your community until you subscribe.")) {
      return;
    }
    
    try {
      setCancellingTrial(true);
      setLocalError(null);
      
      // Call the trial cancellation endpoint
      const response = await fetch(`/api/community/${slug}/cancel-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel trial');
      }
      
      const data = await response.json();
      console.log('Trial cancellation response:', data);
      
      // Set success state
      setCancelSuccess(true);
      
      // Update the billing info without refreshing the page
      if (data.community) {
        updateBillingData({
          _id: data.community._id,
          adminTrialInfo: { activated: false, startDate: undefined, endDate: undefined },
          paymentStatus: data.community.paymentStatus,
          subscriptionEndDate: undefined,
          freeTrialActivated: false
        });
      }
      
      // Show success message
      alert('Trial cancelled successfully. Your community has been suspended until you subscribe.');
      
      // Refresh the page to show updated status
      router.refresh();
    } catch (err) {
      console.error('Error cancelling trial:', err);
      setLocalError(err instanceof Error ? err.message : 'Failed to cancel trial');
    } finally {
      setCancellingTrial(false);
    }
  };

  // Function to cancel subscription
  const cancelSubscription = async () => {
    // Check if we have subscription info
    if (!subscriptionActive) {
      setLocalError("No active subscription found to cancel");
      return;
    }

    if (!billingInfo?._id) {
      setLocalError("Community information not available");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to cancel your subscription? You will continue to have access until the end of your current billing period. No refunds will be provided after payment completion."
    );

    if (!confirmed) return;

    try {
      setCancellingSubscription(true);
      setLocalError(null);

      // Try to cancel using subscriptionId if available, otherwise use community-based cancellation
      let requestBody;
      let endpoint;

      if (billingInfo.subscriptionId) {
        // Use the existing subscription cancellation endpoint
        endpoint = "/api/community-subscriptions/cancel";
        requestBody = {
          subscriptionId: billingInfo.subscriptionId,
          communityId: billingInfo._id,
          cancelAtCycleEnd: true
        };
      } else {
        // Use community-based cancellation endpoint
        endpoint = `/api/community/${slug}/cancel-subscription`;
        requestBody = {
          communityId: billingInfo._id,
          cancelAtCycleEnd: true
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message);
        // Update billing info to reflect cancellation
        updateBillingData({
          subscriptionStatus: "cancelled"
        });
      } else {
        throw new Error(data.error || "Failed to cancel subscription");
      }
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      setLocalError(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setCancellingSubscription(false);
    }
  };



  // Format date to a readable string
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Payment success handler
  const handlePaymentSuccess = async (subscription: any) => {
    try {
      setPaymentLoading(true);

      // Update local billing info to reflect paid status
      updateBillingData({
        paymentStatus: 'paid',
        subscriptionStatus: 'active',
        subscriptionEndDate: subscription.currentEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

      // Close the settings modal
      closeModals();

      // Redirect to the community page using slug URL with success parameter
      // The community page will handle showing the success notification
      router.push(`/Newcompage/${slug}?subscription=success`);
    } catch (err) {
      setLocalError("Payment was successful but we couldn't update your community. Please contact support.");
      console.error(err);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Payment error handler
  const handlePaymentError = (error: any) => {
    setLocalError("Payment failed: " + (error.description || error.message || "Unknown error"));
    console.error("Payment error:", error);
    setPaymentLoading(false);
  };

  // Manual refresh function
  const handleManualRefresh = () => {
    setLocalError(null); // Clear any local errors
    refreshBillingData();
    fetchAvailablePlans();
  };

  // Initialize subscription plans
  const initializePlans = async () => {
    setInitializingPlans(true);
    setLocalError(null);

    try {
      const response = await fetch("/api/admin/initialize-plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh available plans
        await fetchAvailablePlans();
        setLocalError(null);
      } else {
        setLocalError(data.error || "Failed to initialize plans");
      }
    } catch (error: any) {
      setLocalError("Failed to initialize plans: " + error.message);
    } finally {
      setInitializingPlans(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show context error or local error
  const displayError = contextError || localError;
  if (displayError) {
    return (
      <div className="p-4 bg-error/10 rounded-lg flex items-center gap-3 text-error">
        <AlertCircle className="w-6 h-6" />
        <div className="flex-1">
          <p>{displayError}</p>
          {localError && (
            <button
              onClick={() => setLocalError(null)}
              className="text-xs underline mt-1 hover:no-underline"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-8">
      {/* Trial Reminder Banner */}
      <TrialReminderBanner
        communityId={billingInfo?._id}
        communitySlug={slug}
      />

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Billing & Subscription</h2>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="btn btn-outline btn-sm"
          title="Refresh billing information"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>


      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h3 className="card-title flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Trial Status
            </h3>
            
            {subscriptionActive ? (
              <div className="space-y-4">
                <div className="alert alert-success">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  <p>You have an active subscription! Trial period is no longer needed.</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium">Status:</span>
                  <span className="font-semibold text-success">Active Subscription</span>
                </div>
              </div>
            ) : trialActive ? (
              <div className="space-y-4">
                <div className="alert alert-success">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  <p>Trial is active! You have access to all premium features.</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium">Trial Period:</span>
                  <span className="font-semibold" style={{ color: "var(--brand-primary)" }}>{daysRemaining} days remaining</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full"
                    style={{ width: `${percentRemaining}%`, backgroundColor: "var(--brand-primary)" }}
                  ></div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-600">
                  {billingInfo?.adminTrialInfo?.startDate && (
                    <span>Started: {formatDate(billingInfo.adminTrialInfo.startDate)}</span>
                  )}
                  {billingInfo?.adminTrialInfo?.endDate && (
                    <span>Ends: {formatDate(billingInfo.adminTrialInfo.endDate)}</span>
                  )}
                </div>

                {/* Cancel Trial Button - only show for active trials */}
                <div className="mt-4">
                  <button
                    onClick={cancelTrial}
                    disabled={cancellingTrial}
                    className="btn btn-outline btn-error w-full"
                  >
                    {cancellingTrial ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Cancelling Trial...
                      </>
                    ) : (
                      "Cancel Trial"
                    )}
                  </button>
                  {cancelSuccess && (
                    <div className="alert alert-success mt-2">
                      <p>Trial cancelled successfully. Your community has been suspended.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="alert alert-info">
                  <p>No active trial. You can start a 14-day free trial or subscribe directly.</p>
                </div>

                {activationSuccess ? (
                  <div className="alert alert-success">
                    <p>Trial activated successfully! The page will refresh shortly.</p>
                  </div>
                ) : localError ? (
                  <div className="alert alert-error">
                    <p>{localError}</p>
                    <button
                      onClick={() => setLocalError(null)}
                      className="text-xs underline ml-2 hover:no-underline"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}

                <Link
                  href={`/billing/${slug}`}
                  className="btn btn-primary w-full"
                >
                  Go to Billing Page
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h3 className="card-title flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Subscription Status
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Current Status:</span>
                <span className={`font-semibold ${
                  subscriptionActive ? "text-success" :
                  trialActive ? "text-warning" :
                  "text-error"
                }`}>
                  {subscriptionActive ? "Premium (Active)" :
                   trialActive ? "Trial Period" :
                   billingInfo?.paymentStatus === "expired" ? "Expired" : "Free Plan"}
                </span>
              </div>

              {subscriptionActive && billingInfo?.subscriptionEndDate && (
                <div className="flex justify-between items-center">
                  <span className="font-medium">Renews On:</span>
                  <span>{formatDate(billingInfo.subscriptionEndDate)}</span>
                </div>
              )}

              {subscriptionActive && billingInfo?.subscriptionStatus !== "cancelled" && (
                <div className="mt-4">
                  <button
                    onClick={cancelSubscription}
                    disabled={cancellingSubscription}
                    className="btn btn-outline btn-error w-full"
                  >
                    <X className="w-4 h-4" />
                    {cancellingSubscription ? "Cancelling..." : "Cancel Subscription"}
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    No refunds after payment completion. Access continues until end of billing period.
                  </p>
                </div>
              )}

              {subscriptionActive && billingInfo?.subscriptionStatus === "cancelled" && (
                <div className="mt-4 alert alert-warning">
                  <AlertCircle className="w-5 h-5" />
                  <span>Subscription cancelled. Access until {formatDate(billingInfo?.subscriptionEndDate)}</span>
                </div>
              )}

              {trialActive && !subscriptionActive && (
                <div className="flex justify-between items-center">
                  <span className="font-medium">Trial Ends:</span>
                  <span>{formatDate(billingInfo?.adminTrialInfo?.endDate)}</span>
                </div>
              )}
              
              {(billingInfo?.paymentStatus === "unpaid" || billingInfo?.paymentStatus === "expired" || billingInfo?.paymentStatus === "trial") && (
                <div className="mt-4">
                  <Link 
                    href={`/billing/${slug}`}
                    className="btn btn-primary btn-block"
                  >
                    Upgrade Now
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pay Now Section - Only show if not subscribed */}
      {!subscriptionActive && (
        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h3 className="card-title flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Subscribe Now
            </h3>

            <div className="space-y-6">
              <div className="bg-base-100 p-6 rounded-lg">
                <h4 className="text-lg font-bold mb-4 text-primary">Pay Now</h4>
                <p className="mb-4 text-sm">
                  Skip the trial and start your subscription immediately. You'll be charged {availablePlan ? `$${availablePlan.amount}/${availablePlan.interval}` : '$29/month'}
                  starting today. Payment will be processed in {availablePlan?.currency || 'INR'} equivalent.
                </p>

                <ul className="mb-6 space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Full access to all premium features</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Flexible monthly billing</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-success mr-2" />
                    <span className="text-sm">Priority support</span>
                  </li>
                </ul>

                {trialActive ? (
                  <TrialConversionButton
                    communityId={billingInfo?._id}
                    communitySlug={slug}
                    daysRemaining={daysRemaining}
                    size="lg"
                    showFeatures={true}
                    context="billing"
                    disabled={paymentLoading}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                ) : (
                  <PayNowButton
                    communityId={billingInfo?._id}
                    communitySlug={slug}
                    buttonText="Subscribe Now ($29/month)"
                    variant="primary"
                    size="lg"
                    showFeatures={true}
                    context="billing"
                    disabled={paymentLoading}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                )}
              </div>

              {!trialActive && (
                <div className="bg-base-100 p-6 rounded-lg">
                  <h4 className="text-lg font-bold mb-4 text-primary">Or Start Free Trial</h4>
                  <p className="mb-4 text-sm">
                    Try all premium features for 14 days without any charge. This trial is exclusive to you as the community admin.
                  </p>

                  <button
                    onClick={activateTrialDirectly}
                    disabled={activatingTrial}
                    className="btn btn-outline btn-primary w-full"
                  >
                    {activatingTrial ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Activating Trial...
                      </>
                    ) : (
                      "Start 14-Day Free Trial"
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card bg-base-200 shadow-md">
        <div className="card-body">
          <h3 className="card-title">Billing History</h3>
          
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {billingInfo?.adminTrialInfo?.activated ? (
                  <tr>
                    <td>{formatDate(billingInfo.adminTrialInfo.startDate)}</td>
                    <td>14-Day Free Trial</td>
                    <td>$0.00</td>
                    <td>
                      <span className="badge badge-success">Active</span>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-4">No billing history available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
