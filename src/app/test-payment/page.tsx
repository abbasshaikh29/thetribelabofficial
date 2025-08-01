"use client";

import { useSession } from "next-auth/react";
import SimplePaymentButton from "@/components/payments/SimplePaymentButton";

/**
 * Test page to debug payment button functionality
 * Access at: http://localhost:3000/test-payment
 */
export default function TestPaymentPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="p-8">Loading session...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Payment Button Test</h1>
        
        {/* Session Status */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Authentication Status</h2>
          <div className="space-y-2">
            <p><strong>Status:</strong> {status}</p>
            <p><strong>Authenticated:</strong> {session?.user ? "✅ Yes" : "❌ No"}</p>
            {session?.user && (
              <>
                <p><strong>User ID:</strong> {session.user.id}</p>
                <p><strong>Email:</strong> {session.user.email}</p>
                <p><strong>Name:</strong> {session.user.name}</p>
              </>
            )}
          </div>
        </div>

        {/* Environment Check */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Check</h2>
          <div className="space-y-2">
            <p><strong>Razorpay Key:</strong> {process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ? "✅ Set" : "❌ Not set"}</p>
            <p><strong>Key Value:</strong> {process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "Not found"}</p>
          </div>
        </div>

        {/* Payment Button Test */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Payment Button Test</h2>
          
          {!session?.user ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">❌ You must be logged in to test payments</p>
              <a 
                href="/api/auth/signin" 
                className="btn btn-primary"
              >
                Sign In
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-green-600">✅ Ready to test payment</p>
              
              <SimplePaymentButton
                communityId="684ef467a521f59e292a5006" // Iran-won community ID
                communitySlug="iran-won"
                buttonText="🧪 Test Payment - $29/month"
                className="btn btn-primary btn-lg w-full"
                onSuccess={(subscription) => {
                  alert("✅ Payment successful! Subscription: " + subscription.id);
                }}
                onError={(error) => {
                  alert("❌ Payment failed: " + error);
                }}
              />
              
              <div className="text-sm text-gray-600 mt-4">
                <p><strong>Instructions:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open browser developer tools (F12)</li>
                  <li>Go to Console tab</li>
                  <li>Click the payment button above</li>
                  <li>Watch for console messages</li>
                  <li>Check Network tab for API calls</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Manual API Test */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Manual API Test</h2>
          
          {session?.user ? (
            <button
              onClick={async () => {
                console.log("🧪 Testing API call manually...");
                
                try {
                  const response = await fetch("/api/community-subscriptions/create", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      communityId: "684ef467a521f59e292a5006",
                      adminId: session.user.id,
                      customerNotify: true,
                      notes: {
                        planName: "Test Plan",
                        adminEmail: session.user.email,
                        communityId: "684ef467a521f59e292a5006"
                      }
                    }),
                  });
                  
                  const data = await response.json();
                  console.log("API Response:", { status: response.status, data });
                  
                  if (response.ok) {
                    alert("✅ API call successful! Check console for details.");
                  } else {
                    alert("❌ API call failed: " + (data.error || "Unknown error"));
                  }
                } catch (error) {
                  console.error("API Error:", error);
                  alert("❌ Network error: " + error.message);
                }
              }}
              className="btn btn-secondary"
            >
              🧪 Test API Call Manually
            </button>
          ) : (
            <p className="text-gray-600">Sign in to test API calls</p>
          )}
        </div>

        {/* Back to Billing */}
        <div className="mt-8 text-center">
          <a 
            href="/billing/iran-won" 
            className="btn btn-outline"
          >
            ← Back to Billing Page
          </a>
        </div>
      </div>
    </div>
  );
}
