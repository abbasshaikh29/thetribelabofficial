"use client";
import React from "react";
import Header from "@/components/Header";
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function PricingPage() {
  const { data: session } = useSession();

  return (
    <main className="min-h-screen">
      <Header />

      <div className="py-16 relative overflow-hidden transition-colors duration-300" style={{ backgroundColor: "var(--bg-primary)" }}>
        {/* Modern decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r opacity-30" style={{ backgroundImage: "linear-gradient(to right, var(--brand-primary), var(--brand-secondary), var(--brand-accent))" }}></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 opacity-5 rounded-full blur-3xl" style={{ backgroundColor: "var(--brand-primary)" }}></div>
        <div className="absolute -bottom-20 -left-20 w-60 h-60 opacity-5 rounded-full blur-3xl" style={{ backgroundColor: "var(--brand-secondary)" }}></div>

        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: "var(--brand-primary)", color: "white", opacity: 0.9 }}>
              ✨ Community Management Platform
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>
              One Simple Plan for Community Admins
            </h1>
            <p className="text-lg max-w-2xl mx-auto mb-8" style={{ color: "var(--text-secondary)" }}>
              Everything you need to manage your community with unlimited features and a 14-day free trial.
            </p>
          </div>

          <div className="flex justify-center mb-16">
            <div className="w-full max-w-lg">
              <div className="card border hover:shadow-lg transition-all duration-300 overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--brand-primary)" }}>
                <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: "var(--brand-primary)" }}></div>
                <div className="card-body p-8 text-center">
                  <h3 className="card-title text-3xl font-bold mb-4 justify-center" style={{ color: "var(--brand-primary)" }}>
                    Community Management Plan
                  </h3>
                  <div className="mb-6">
                    <span className="text-5xl font-bold" style={{ color: "var(--text-primary)" }}>
                      $29
                    </span>
                    <span style={{ color: "var(--text-secondary)" }}>/month</span>
                    <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
                      Processed as ₹2,400 INR • Cancel anytime
                    </p>
                    <div className="mt-4 px-4 py-3 rounded-lg text-sm font-medium" style={{ backgroundColor: "var(--brand-primary)", color: "white", opacity: 0.9 }}>
                      🎉 14-Day Free Trial Included • No Credit Card Required
                    </div>
                  </div>
                  <ul className="space-y-4 mb-8 text-left">
                    <li className="flex items-start gap-3">
                      <span className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-primary)", color: "white" }}>
                        <Check className="w-3 h-3" />
                      </span>
                      <span style={{ color: "var(--text-primary)" }}>Unlimited members</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-primary)", color: "white" }}>
                        <Check className="w-3 h-3" />
                      </span>
                      <span style={{ color: "var(--text-primary)" }}>Unlimited storage</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-primary)", color: "white" }}>
                        <Check className="w-3 h-3" />
                      </span>
                      <span style={{ color: "var(--text-primary)" }}>Unlimited events & channels</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-primary)", color: "white" }}>
                        <Check className="w-3 h-3" />
                      </span>
                      <span style={{ color: "var(--text-primary)" }}>Analytics & insights</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-primary)", color: "white" }}>
                        <Check className="w-3 h-3" />
                      </span>
                      <span style={{ color: "var(--text-primary)" }}>Email support</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-primary)", color: "white" }}>
                        <Check className="w-3 h-3" />
                      </span>
                      <span style={{ color: "var(--text-primary)" }}>Community management tools</span>
                    </li>
                  </ul>
                  <div className="card-actions mt-auto flex flex-col gap-4 w-full">
                    {session ? (
                      <Link href="/communityform" className="w-full">
                        <button
                          type="button"
                          className="btn bg-primary text-white hover:bg-primary/90 w-full border-none hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-lg py-3"
                        >
                          Create Your Community
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </button>
                      </Link>
                    ) : (
                      <Link href="/api/auth/signin" className="w-full">
                        <button
                          type="button"
                          className="btn bg-primary text-white hover:bg-primary/90 w-full border-none hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-lg py-3"
                        >
                          Sign In to Get Started
                        </button>
                      </Link>
                    )}
                    <p className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>
                      Start your 14-day free trial when you create a community
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* How it Works */}
          <div className="mt-16">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8" style={{ color: "var(--text-primary)" }}>
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
                  1
                </div>
                <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Create Community</h3>
                <p style={{ color: "var(--text-secondary)" }}>Set up your community with our easy-to-use tools</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
                  2
                </div>
                <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>14-Day Free Trial</h3>
                <p style={{ color: "var(--text-secondary)" }}>Try all features for free, no credit card required</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
                  3
                </div>
                <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Subscribe & Grow</h3>
                <p style={{ color: "var(--text-secondary)" }}>Continue with $29/month for unlimited access</p>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="mt-16">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8" style={{ color: "var(--text-primary)" }}>
              Frequently Asked Questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                className="card border p-6 transition-all duration-300"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--border-color)",
                  boxShadow: "var(--shadow-md)"
                }}
              >
                <h3 className="text-xl font-bold mb-2" style={{ color: "var(--brand-primary)" }}>
                  Can I cancel anytime?
                </h3>
                <p style={{ color: "var(--text-secondary)" }}>
                  Yes, you can cancel your subscription at any time. There are
                  no long-term contracts or commitments.
                </p>
              </div>
              <div
                className="card border p-6 transition-all duration-300"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--border-color)",
                  boxShadow: "var(--shadow-md)"
                }}
              >
                <h3 className="text-xl font-bold mb-2" style={{ color: "var(--brand-primary)" }}>
                  How does the free trial work?
                </h3>
                <p style={{ color: "var(--text-secondary)" }}>
                  Start your 14-day free trial when you create a community. No credit card required.
                  After the trial, continue with $29/month for unlimited access.
                </p>
              </div>
              <div
                className="card border p-6 transition-all duration-300"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--border-color)",
                  boxShadow: "var(--shadow-md)"
                }}
              >
                <h3 className="text-xl font-bold mb-2" style={{ color: "var(--brand-primary)" }}>
                  What's included in the plan?
                </h3>
                <p style={{ color: "var(--text-secondary)" }}>
                  Everything you need: unlimited members, storage, events, channels,
                  analytics, and email support. No usage limitations.
                </p>
              </div>
              <div
                className="card border p-6 transition-all duration-300"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--border-color)",
                  boxShadow: "var(--shadow-md)"
                }}
              >
                <h3 className="text-xl font-bold mb-2" style={{ color: "var(--brand-primary)" }}>
                  Can I cancel anytime?
                </h3>
                <p style={{ color: "var(--text-secondary)" }}>
                  Yes, you can cancel your subscription at any time. No contracts,
                  no commitments. Your community remains accessible until the end of your billing period.
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              Ready to Build Your Community?
            </h2>
            <p className="text-lg max-w-2xl mx-auto mb-8" style={{ color: "var(--text-secondary)" }}>
              Create your community today and start your 14-day free trial. No credit card required.
            </p>
            {session ? (
              <Link href="/communityform">
                <button
                  type="button"
                  className="btn bg-primary text-white hover:bg-primary/90 px-8 py-3 text-lg border-none hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                >
                  Create Your Community
                  <ArrowRight className="w-5 h-5 ml-2" />
                </button>
              </Link>
            ) : (
              <Link href="/api/auth/signin">
                <button
                  type="button"
                  className="btn bg-primary text-white hover:bg-primary/90 px-8 py-3 text-lg border-none hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                >
                  Sign In to Get Started
                </button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
