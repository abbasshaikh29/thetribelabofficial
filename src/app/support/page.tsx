"use client";

import React, { useState } from "react";
import Header from "@/components/Header";
import Link from "next/link";

export default function SupportPage() {
  const [activeTab, setActiveTab] = useState("payment-setup");

  const tabs = [
    { id: "payment-setup", label: "Payment Setup", icon: "💳" },
    { id: "admin-guide", label: "Admin Guide", icon: "👨‍💼" },
    { id: "member-guide", label: "Member Guide", icon: "👥" },
    { id: "troubleshooting", label: "Troubleshooting", icon: "🔧" },
    { id: "contact", label: "Contact Support", icon: "📞" },
  ];

  return (
    <main className="min-h-screen">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Help Center
          </h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Everything you need to know about managing your community
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            {activeTab === "payment-setup" && <PaymentSetupGuide />}
            {activeTab === "admin-guide" && <AdminGuide />}
            {activeTab === "member-guide" && <MemberGuide />}
            {activeTab === "troubleshooting" && <TroubleshootingGuide />}
            {activeTab === "contact" && <ContactSupport />}
          </div>
        </div>
      </div>
    </main>
  );
}

// Payment Setup Guide Component
function PaymentSetupGuide() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-2xl font-bold mb-6 text-blue-600">
        💳 Payment Gateway Setup Guide
      </h2>
      <p className="text-gray-600 mb-6">
        Step-by-step guide to set up payment collection from your community
        members.
        <strong> Members pay you directly - we take 0% commission!</strong>
      </p>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-blue-400 text-xl">ℹ️</span>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Quick Setup:</strong> Total time ~25 minutes | Difficulty:
              Beginner-friendly
            </p>
          </div>
        </div>
      </div>

      {/* Step-by-step guide */}
      <div className="space-y-8">
        <div className="border-l-4 border-green-400 pl-6">
          <h3 className="text-xl font-semibold mb-3 text-green-600">
            Step 1: Create Your Razorpay Account (10 mins)
          </h3>
          <div className="space-y-3">
            <p>
              <strong>Why Razorpay?</strong> Most popular payment gateway in
              India, supports all payment methods (cards, UPI, wallets), money
              goes directly to your bank account.
            </p>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium mb-2">Account Signup:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Go to{" "}
                  <a
                    href="https://razorpay.com"
                    target="_blank"
                    className="text-blue-600 underline"
                  >
                    https://razorpay.com
                  </a>
                </li>
                <li>Click "Sign Up for Free"</li>
                <li>Fill business information (use your community name)</li>
                <li>Select "Education" or "Services" as business type</li>
                <li>Complete email and phone verification</li>
              </ol>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="font-medium mb-2">Business Verification (KYC):</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Upload PAN Card (mandatory)</li>
                <li>Business registration (if company)</li>
                <li>Bank account details</li>
                <li>Wait 24-48 hours for approval</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-l-4 border-blue-400 pl-6">
          <h3 className="text-xl font-semibold mb-3 text-blue-600">
            Step 2: Get API Keys & Connect (5 mins)
          </h3>
          <div className="space-y-3">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium mb-2">In Razorpay Dashboard:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to Settings → API Keys</li>
                <li>Generate Test Key (for testing first)</li>
                <li>Copy Key ID and Key Secret</li>
                <li>Keep these credentials secure</li>
              </ol>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium mb-2">In Your Community Settings:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to Community Settings → Payment Gateway</li>
                <li>Click "Connect Razorpay Account"</li>
                <li>Enter your API credentials</li>
                <li>Click "Validate & Save"</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="border-l-4 border-purple-400 pl-6">
          <h3 className="text-xl font-semibold mb-3 text-purple-600">
            Step 3: Set Your Pricing (3 mins)
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="font-medium text-green-600">Monthly Plan</p>
                <p className="text-sm">₹299-999/month</p>
                <p className="text-xs text-gray-600">Recurring revenue</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-medium text-blue-600">Yearly Plan</p>
                <p className="text-sm">₹2999-9999/year</p>
                <p className="text-xs text-gray-600">Better value</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="font-medium text-orange-600">One-time</p>
                <p className="text-sm">₹999-4999</p>
                <p className="text-xs text-gray-600">Lifetime access</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              <strong>Note:</strong> Plans are created automatically in your
              Razorpay account when you save pricing.
            </p>
          </div>
        </div>

        <div className="border-l-4 border-orange-400 pl-6">
          <h3 className="text-xl font-semibold mb-3 text-orange-600">
            Step 4: Test Payment Flow (5 mins)
          </h3>
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="font-medium text-red-600 mb-2">
                ⚠️ Important: Test Before Going Live!
              </p>
              <p className="text-sm">
                Always test the complete payment flow before accepting real
                payments.
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-medium mb-2">Test Payment Details:</p>
              <div className="text-sm space-y-1">
                <p>
                  <strong>Card Number:</strong> 4111 1111 1111 1111
                </p>
                <p>
                  <strong>Expiry:</strong> Any future date (e.g., 12/25)
                </p>
                <p>
                  <strong>CVV:</strong> Any 3 digits (e.g., 123)
                </p>
                <p>
                  <strong>UPI ID:</strong> success@razorpay
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-l-4 border-green-400 pl-6">
          <h3 className="text-xl font-semibold mb-3 text-green-600">
            Step 5: Go Live (2 mins)
          </h3>
          <div className="space-y-3">
            <ol className="list-decimal list-inside space-y-2">
              <li>Generate Live API keys in Razorpay Dashboard</li>
              <li>Update your community settings with Live credentials</li>
              <li>Test with a small real payment (₹1-10)</li>
              <li>Announce your paid community launch!</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="text-lg font-semibold text-green-600 mb-3">
          🎉 Congratulations! You're Ready to Accept Payments
        </h3>
        <ul className="text-sm space-y-1">
          <li>✅ Members pay you directly (0% platform commission)</li>
          <li>✅ Money goes straight to your bank account</li>
          <li>✅ Professional payment pages with your branding</li>
          <li>✅ Support for all payment methods in India</li>
        </ul>
      </div>
    </div>
  );
}

// Admin Guide Component
function AdminGuide() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-2xl font-bold mb-6 text-blue-600">👨‍💼 Admin Guide</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Community Management</h3>
          <ul className="space-y-2 text-sm">
            <li>• Create and customize your community</li>
            <li>• Set up payment gateways</li>
            <li>• Manage member requests</li>
            <li>• Configure privacy settings</li>
            <li>• Assign sub-admin roles</li>
          </ul>
        </div>

        <div className="bg-green-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Revenue Management</h3>
          <ul className="space-y-2 text-sm">
            <li>• Set subscription pricing</li>
            <li>• Monitor payment analytics</li>
            <li>• Handle refunds and disputes</li>
            <li>• Track member retention</li>
            <li>• Download financial reports</li>
          </ul>
        </div>

        <div className="bg-yellow-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">14-Day Free Trial</h3>
          <ul className="space-y-2 text-sm">
            <li>• Try all features for free</li>
            <li>• No credit card required</li>
            <li>• Get reminders before expiration</li>
            <li>• Seamless upgrade to paid plan</li>
            <li>• Continue with $29/month</li>
          </ul>
        </div>

        <div className="bg-purple-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Best Practices</h3>
          <ul className="space-y-2 text-sm">
            <li>• Deliver consistent value</li>
            <li>• Engage with members regularly</li>
            <li>• Create exclusive content</li>
            <li>• Gather feedback and improve</li>
            <li>• Build community culture</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Member Guide Component
function MemberGuide() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-2xl font-bold mb-6 text-blue-600">👥 Member Guide</h2>

      <div className="space-y-6">
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Joining Communities</h3>
          <div className="space-y-3 text-sm">
            <p>
              <strong>Free Communities:</strong> Join instantly, no payment
              required
            </p>
            <p>
              <strong>Paid Communities:</strong> Pay subscription to join, get
              immediate access
            </p>
            <p>
              <strong>Private Communities:</strong> Submit join request, wait
              for admin approval
            </p>
            <p>
              <strong>Public Communities:</strong> Join automatically after
              payment
            </p>
          </div>
        </div>

        <div className="bg-green-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Payment Process</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Browse communities and find one you like</li>
            <li>Click "Join Community" or "Subscribe"</li>
            <li>Choose your preferred plan (monthly/yearly)</li>
            <li>Complete payment using your preferred method</li>
            <li>Get instant access to community content</li>
          </ol>
        </div>

        <div className="bg-yellow-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">
            Supported Payment Methods
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">India:</p>
              <ul className="list-disc list-inside">
                <li>Credit/Debit Cards</li>
                <li>UPI (GPay, PhonePe, etc.)</li>
                <li>Net Banking</li>
                <li>Wallets (Paytm, etc.)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">International:</p>
              <ul className="list-disc list-inside">
                <li>Visa/Mastercard</li>
                <li>American Express</li>
                <li>PayPal (select gateways)</li>
                <li>Bank transfers</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">
            Managing Your Subscriptions
          </h3>
          <ul className="space-y-2 text-sm">
            <li>• View active subscriptions in your profile</li>
            <li>• Cancel anytime through payment gateway</li>
            <li>• Update payment methods when needed</li>
            <li>• Download payment receipts and invoices</li>
            <li>• Contact community admin for support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Troubleshooting Guide Component
function TroubleshootingGuide() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-2xl font-bold mb-6 text-blue-600">
        🔧 Troubleshooting Guide
      </h2>

      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-red-600">
            Common Payment Issues
          </h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-sm">
                Issue: "API Key Invalid" Error
              </p>
              <p className="text-sm text-gray-600">
                Solution: Double-check Key ID and Secret, ensure correct mode
                (Test/Live), verify account activation
              </p>
            </div>
            <div>
              <p className="font-medium text-sm">
                Issue: "Payment Failed" During Testing
              </p>
              <p className="text-sm text-gray-600">
                Solution: Use exact test card numbers, check internet
                connection, try different browser
              </p>
            </div>
            <div>
              <p className="font-medium text-sm">
                Issue: "Member Paid But No Access"
              </p>
              <p className="text-sm text-gray-600">
                Solution: Check payment success in gateway, verify webhook
                configuration, manually grant access
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-yellow-600">
            Community Access Issues
          </h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-sm">
                Issue: "Community Suspended"
              </p>
              <p className="text-sm text-gray-600">
                Solution: Admin's trial expired or payment failed. Contact admin
                or pay platform subscription
              </p>
            </div>
            <div>
              <p className="font-medium text-sm">
                Issue: "Join Request Pending"
              </p>
              <p className="text-sm text-gray-600">
                Solution: Wait for admin approval (private communities), check
                email for updates
              </p>
            </div>
            <div>
              <p className="font-medium text-sm">
                Issue: "Cannot Access Paid Content"
              </p>
              <p className="text-sm text-gray-600">
                Solution: Verify payment completed, check subscription status,
                contact community admin
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-blue-600">
            Technical Issues
          </h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-sm">Issue: "Page Not Loading"</p>
              <p className="text-sm text-gray-600">
                Solution: Clear browser cache, try incognito mode, check
                internet connection
              </p>
            </div>
            <div>
              <p className="font-medium text-sm">
                Issue: "Notifications Not Working"
              </p>
              <p className="text-sm text-gray-600">
                Solution: Check browser notification settings, verify email
                settings, check spam folder
              </p>
            </div>
            <div>
              <p className="font-medium text-sm">Issue: "Upload Failed"</p>
              <p className="text-sm text-gray-600">
                Solution: Check file size limits, try different file format,
                ensure stable internet
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Contact Support Component
function ContactSupport() {
  return (
    <div className="prose max-w-none">
      <h2 className="text-2xl font-bold mb-6 text-blue-600">
        📞 Contact Support
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Platform Support</h3>
          <div className="space-y-3 text-sm">
            <p>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:support@thetribelab.com"
                className="text-blue-600"
              >
                support@thetribelab.com
              </a>
            </p>
            <p>
              <strong>Response Time:</strong> Within 24 hours
            </p>
            <p>
              <strong>Support Hours:</strong> 9 AM - 6 PM IST
            </p>
            <p>
              <strong>For:</strong> Platform issues, billing, technical problems
            </p>
          </div>
        </div>

        <div className="bg-green-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">
            Payment Gateway Support
          </h3>
          <div className="space-y-3 text-sm">
            <p>
              <strong>Razorpay:</strong>{" "}
              <a
                href="https://razorpay.com/support/"
                target="_blank"
                className="text-blue-600"
              >
                razorpay.com/support
              </a>
            </p>
            <p>
              <strong>Stripe:</strong>{" "}
              <a
                href="https://stripe.com/support"
                target="_blank"
                className="text-blue-600"
              >
                stripe.com/support
              </a>
            </p>
            <p>
              <strong>For:</strong> Payment processing, gateway setup,
              transaction issues
            </p>
          </div>
        </div>

        <div className="bg-yellow-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Community Issues</h3>
          <div className="space-y-3 text-sm">
            <p>
              <strong>What to do:</strong> Contact the community admin first
            </p>
            <p>
              <strong>Admin Contact:</strong> Available in community settings
            </p>
            <p>
              <strong>For:</strong> Membership issues, content disputes,
              community rules
            </p>
          </div>
        </div>

        <div className="bg-purple-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Emergency Support</h3>
          <div className="space-y-3 text-sm">
            <p>
              <strong>Critical Issues:</strong> Payment failures, account
              lockouts
            </p>
            <p>
              <strong>Response:</strong> Within 2-4 hours
            </p>
            <p>
              <strong>Email:</strong> Mark subject as "URGENT"
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">
          Before Contacting Support
        </h3>
        <ul className="space-y-2 text-sm">
          <li>✅ Check this help center for solutions</li>
          <li>✅ Try basic troubleshooting (refresh, clear cache)</li>
          <li>✅ Note down error messages or screenshots</li>
          <li>✅ Include your account details and community info</li>
          <li>✅ Describe steps to reproduce the issue</li>
        </ul>
      </div>
    </div>
  );
}
