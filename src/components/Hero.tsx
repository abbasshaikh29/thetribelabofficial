"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import RotatingText from "./RotatingText";
import CircularText from "./CircularText";

function Hero() {
  const animatedWords = ["Empire", "Tribe", "Community", "Group"];
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

  // Animation variants
  const headerVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" },
    },
  };

  const textVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, delay: 0.3, ease: "easeOut" },
    },
  };

  const buttonVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: 0.6, ease: "easeOut" },
    },
  };

  const floatingCircleVariants = {
    animate: {
      x: [0, 10, -10, 0],
      y: [0, -10, 10, 0],
      transition: {
        repeat: Infinity,
        repeatType: "reverse" as const,
        duration: 8,
        ease: "easeInOut",
      },
    },
  };

  // Auto-moving particles
  const autoMovingVariants = {
    orange: {
      animate: {
        opacity: 0.1,
        x: [0, 20, -20, 0],
        y: [0, -15, 15, 0],
        transition: {
          repeat: Infinity,
          repeatType: "reverse" as const,
          duration: 12,
          ease: "easeInOut",
        },
      },
    },
    purple: {
      animate: {
        opacity: 0.1,
        x: [0, -25, 25, 0],
        y: [0, 20, -20, 0],
        transition: {
          repeat: Infinity,
          repeatType: "reverse" as const,
          duration: 15,
          ease: "easeInOut",
        },
      },
    },
  };

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
          <div className="absolute right-[-5rem] top-16">
            <CircularText
              text="FOR CREATORS BY CREATORS."
              spinDuration={10}
              onHover="goBonkers"
              radius={100}
            />
          </div>
          <h1
            className="text-9xl font-bold uppercase text-center leading-tight font-thunder"
            style={{ color: "var(--text-primary)" }}
          >
            Monetize Your Audience
            <br />
            <div className="text-8xl flex justify-center items-center">
              <h2 className="mr-3">Build Your</h2>
              <div className="w-[10ch] ml-3 flex justify-start">
                  <RotatingText
                      texts={animatedWords}
                      mainClassName="inline-flex items-center text-inherit font-inherit leading-none"
                      staggerFrom={"last"}
                      staggerDuration={0.025}
                      splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1 md:pb-1"
                      transition={{ type: "spring", damping: 30, stiffness: 400 }}
                      rotationInterval={5000}
                  />
              </div>
            </div>
          </h1>
          <p
            className="text-center font-sans text-xl font-normal mt-4"
            style={{ color: "var(--text-secondary)" }}
          >
            For creators, influencers: Build, connect, monetize <br />
            your exclusive community. Your audience, your growth.
          </p>

          {/* Buttons Section */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/communityform">
              <button
                className="btn border-transparent px-8 py-3 rounded-md text-lg font-medium transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                style={{
                  backgroundColor: "var(--brand-primary)",
                  color: "white"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--brand-secondary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--brand-primary)";
                }}
              >
                Get Started
              </button>
            </Link>
            <Link href="/community-feed">
              <button
                className="btn btn-outline px-8 py-3 rounded-md text-lg font-medium transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                style={{
                  borderColor: "var(--brand-primary)",
                  color: "var(--brand-primary)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--brand-primary)";
                  e.currentTarget.style.color = "white";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--brand-primary)";
                }}
              >
                Explore
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Hero;
