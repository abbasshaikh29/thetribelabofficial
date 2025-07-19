"use client";
import React, { useEffect, useState } from "react";
import Orb from "./Orb";
import ScrollFloat from "./ScrollFloat";
import SpotlightCard from "./SpotlightCard";

function SecondSection() {
  const [currentTheme, setCurrentTheme] = useState<string | null>(null);

  useEffect(() => {
    const detectTheme = () => {
      const theme =
        document.documentElement.getAttribute("data-theme") || "light";
      setCurrentTheme(theme);
    };

    detectTheme();
    window.addEventListener("theme-change", detectTheme);

    return () => {
      window.removeEventListener("theme-change", detectTheme);
    };
  }, []);

  return (
    <div
      className="min-h-[calc(100vh-var(--header-height,80px)-var(--footer-height,80px))] flex flex-col items-center justify-center relative py-10 px-4 transition-colors duration-300"
      style={{
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)"
      }}
    >
      
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16 relative">
          <ScrollFloat
            animationDuration={.5}
            ease='back.inOut(2)'
            scrollStart='center bottom+=10%'
            scrollEnd='bottom bottom-=40%'
            stagger={0.03}
            containerClassName="mb-8"
            textClassName="text-8xl font-bold uppercase text-center leading-tight font-thunder pointer-events-none"
          >
            Why Choose Our Platform?
          </ScrollFloat>
          
          <p
            className="text-center font-sans text-xl font-normal mt-4 pointer-events-none max-w-4xl mx-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            Discover the tools and features that make building and monetizing your community easier than ever before.
            Join thousands of creators who have already transformed their passion into profit.
          </p>

          {/* Feature Cards */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto px-4">
            <SpotlightCard 
              className="transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 h-full"
              spotlightColor={currentTheme === 'dark' ? "rgba(138, 43, 226, 0.3)" : "rgba(138, 43, 226, 0.2)"}
            >
              <div 
                className="p-6 rounded-xl backdrop-blur-md h-full flex flex-col justify-between min-h-[280px]"
                style={{
                  backgroundColor: currentTheme === 'dark' 
                    ? "rgba(255, 255, 255, 0.1)" 
                    : "rgba(0, 0, 0, 0.05)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: currentTheme === 'dark' 
                    ? "1px solid rgba(255, 255, 255, 0.2)" 
                    : "1px solid rgba(0, 0, 0, 0.1)"
                }}
              >
                <div>
                  <div className="text-4xl mb-4">🚀</div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
                    Easy Setup
                  </h3>
                </div>
                <p className="text-base" style={{ color: "var(--text-secondary)" }}>
                  Get your community up and running in minutes with our intuitive setup process.
                </p>
              </div>
            </SpotlightCard>

            <SpotlightCard 
              className="transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 h-full"
              spotlightColor={currentTheme === 'dark' ? "rgba(0, 229, 255, 0.3)" : "rgba(0, 229, 255, 0.2)"}
            >
              <div 
                className="p-6 rounded-xl backdrop-blur-md h-full flex flex-col justify-between min-h-[280px]"
                style={{
                  backgroundColor: currentTheme === 'dark' 
                    ? "rgba(255, 255, 255, 0.1)" 
                    : "rgba(0, 0, 0, 0.05)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: currentTheme === 'dark' 
                    ? "1px solid rgba(255, 255, 255, 0.2)" 
                    : "1px solid rgba(0, 0, 0, 0.1)"
                }}
              >
                <div>
                  <div className="text-4xl mb-4">💰</div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
                    Multiple Revenue Streams
                  </h3>
                </div>
                <p className="text-base" style={{ color: "var(--text-secondary)" }}>
                  Subscriptions, courses, events, and more - diversify your income effortlessly.
                </p>
              </div>
            </SpotlightCard>

            <SpotlightCard 
              className="transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 h-full"
              spotlightColor={currentTheme === 'dark' ? "rgba(255, 165, 0, 0.3)" : "rgba(255, 165, 0, 0.2)"}
            >
              <div 
                className="p-6 rounded-xl backdrop-blur-md h-full flex flex-col justify-between min-h-[280px]"
                style={{
                  backgroundColor: currentTheme === 'dark' 
                    ? "rgba(255, 255, 255, 0.1)" 
                    : "rgba(0, 0, 0, 0.05)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: currentTheme === 'dark' 
                    ? "1px solid rgba(255, 255, 255, 0.2)" 
                    : "1px solid rgba(0, 0, 0, 0.1)"
                }}
              >
                <div>
                  <div className="text-4xl mb-4">📈</div>
                  <h3 className="text-2xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
                    Analytics & Insights
                  </h3>
                </div>
                <p className="text-base" style={{ color: "var(--text-secondary)" }}>
                  Track your growth and understand your audience with detailed analytics.
                </p>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SecondSection;
