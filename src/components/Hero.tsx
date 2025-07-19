"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import RotatingText from "./RotatingText";
import CircularText from "./CircularText";
import Orb from "./Orb";

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
      className="min-h-[calc(100vh-var(--header-height,80px)-var(--footer-height,80px))] mb-20 flex flex-col items-center justify-center relative py-10 px-4 transition-colors duration-300"
      style={{
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)"
      }}
    >
      {/* Orb Background */}
      <div className="absolute inset-0">
        <div style={{ width: '100%', height: '600px', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <Orb
            hoverIntensity={4.02}
            rotateOnHover={false}
            hue={270}
            forceHoverState={false}
          />
        </div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16 relative">
          <div className="absolute right-[-15rem] top-16">
            <CircularText
              text="FOR CREATORS BY CREATORS."
              spinDuration={10}
              onHover="goBonkers"
              radius={100}
            />
          </div>
          <h1
            className="text-9xl font-bold uppercase text-center leading-tight font-thunder pointer-events-none"
            style={{ color: "var(--text-primary)" }}
          >
            Monetize Your Audience
            <br />
            <div className="text-8xl flex justify-center items-center">
              <h2 className="">Build Your</h2>
              <div className="w-[10ch] ml-5 flex justify-start">
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
            className="text-center font-sans text-xl font-normal mt-4 pointer-events-none"
            style={{ color: "var(--text-secondary)" }}
          >
            create community with your audiance <br />and turn it into a real profitable bussiness
            
          </p>

          {/* Buttons Section */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 pointer-events-auto">
            <Link href="/communityform">
              <button
                className="btn border-transparent px-8 py-3 rounded-xl text-lg font-medium transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 pointer-events-auto"
                style={{
                  backgroundColor: currentTheme === 'dark' 
                    ? "rgba(138, 43, 226, 0.2)" 
                    : "rgba(138, 43, 226, 0.15)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: currentTheme === 'dark' 
                    ? "1px solid rgba(138, 43, 226, 0.3)" 
                    : "1px solid rgba(138, 43, 226, 0.4)",
                  color: currentTheme === 'dark' ? "white" : "white",
                  boxShadow: currentTheme === 'dark' 
                    ? "0 8px 32px rgba(138, 43, 226, 0.3)" 
                    : "0 8px 32px rgba(138, 43, 226, 0.4)"
                }}
                onMouseEnter={(e) => {
                  const hoverBg = currentTheme === 'dark' 
                    ? "rgba(138, 43, 226, 0.4)" 
                    : "rgba(138, 43, 226, 0.3)";
                  const hoverShadow = currentTheme === 'dark' 
                    ? "0 12px 40px rgba(138, 43, 226, 0.5)" 
                    : "0 12px 40px rgba(138, 43, 226, 0.6)";
                  e.currentTarget.style.backgroundColor = hoverBg;
                  e.currentTarget.style.boxShadow = hoverShadow;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  const normalBg = currentTheme === 'dark' 
                    ? "rgba(138, 43, 226, 0.2)" 
                    : "rgba(138, 43, 226, 0.15)";
                  const normalShadow = currentTheme === 'dark' 
                    ? "0 8px 32px rgba(138, 43, 226, 0.3)" 
                    : "0 8px 32px rgba(138, 43, 226, 0.4)";
                  e.currentTarget.style.backgroundColor = normalBg;
                  e.currentTarget.style.boxShadow = normalShadow;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Get Started
              </button>
            </Link>
            <Link href="/community-feed">
              <button
                className="btn px-8 py-3 rounded-xl text-lg font-medium transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 pointer-events-auto"
                style={{
                  backgroundColor: currentTheme === 'dark' 
                    ? "rgba(255, 255, 255, 0.1)" 
                    : "rgba(0, 0, 0, 0.1)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: currentTheme === 'dark' 
                    ? "1px solid rgba(255, 255, 255, 0.2)" 
                    : "1px solid rgba(0, 0, 0, 0.2)",
                  color: currentTheme === 'dark' ? "white" : "var(--text-primary)",
                  boxShadow: currentTheme === 'dark' 
                    ? "0 8px 32px rgba(0, 0, 0, 0.3)" 
                    : "0 8px 32px rgba(0, 0, 0, 0.2)"
                }}
                onMouseEnter={(e) => {
                  const hoverBg = currentTheme === 'dark' 
                    ? "rgba(255, 255, 255, 0.2)" 
                    : "rgba(0, 0, 0, 0.15)";
                  const hoverShadow = currentTheme === 'dark' 
                    ? "0 12px 40px rgba(0, 0, 0, 0.4)" 
                    : "0 12px 40px rgba(0, 0, 0, 0.3)";
                  e.currentTarget.style.backgroundColor = hoverBg;
                  e.currentTarget.style.boxShadow = hoverShadow;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  const normalBg = currentTheme === 'dark' 
                    ? "rgba(255, 255, 255, 0.1)" 
                    : "rgba(0, 0, 0, 0.1)";
                  const normalShadow = currentTheme === 'dark' 
                    ? "0 8px 32px rgba(0, 0, 0, 0.3)" 
                    : "0 8px 32px rgba(0, 0, 0, 0.2)";
                  e.currentTarget.style.backgroundColor = normalBg;
                  e.currentTarget.style.boxShadow = normalShadow;
                  e.currentTarget.style.transform = "translateY(0)";
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
