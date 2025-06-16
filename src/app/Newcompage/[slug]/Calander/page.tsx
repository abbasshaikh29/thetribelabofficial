"use client";

import Calander from "@/components/communitynav/Calander";
import CommunityNav from "@/components/communitynav/CommunityNav";
import React, { useEffect } from "react";

function CalendarPage() {
  // Force the correct background color for this page
  useEffect(() => {
    // Apply the background color using CSS variables
    document.body.style.backgroundColor = "var(--bg-primary)";
    document.body.style.color = "var(--text-primary)";

    // Cleanup function to remove the style when component unmounts
    return () => {
      document.body.style.removeProperty("backgroundColor");
      document.body.style.removeProperty("color");
    };
  }, []);

  return (
    <div className="calander-page" style={{ backgroundColor: "var(--bg-primary)" }}>
      <CommunityNav />
      <div className="mt-6">
        <Calander />
      </div>
    </div>
  );
}

export default CalendarPage;
