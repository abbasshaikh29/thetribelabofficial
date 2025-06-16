"use client";

import React from "react";

interface LevelBadgeProps {
  level: number;
  levelName?: string;
  size?: "sm" | "md" | "lg";
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "inline";
  className?: string;
}

const LevelBadge: React.FC<LevelBadgeProps> = ({
  level,
  levelName,
  size = "md",
  position = "bottom-right",
  className = "",
}) => {
  const sizeClasses = {
    sm: "w-5 h-5 text-xs",
    md: "w-6 h-6 text-sm",
    lg: "w-8 h-8 text-base",
  };

  const positionClasses = {
    "bottom-right": "absolute -bottom-1 -right-1",
    "bottom-left": "absolute -bottom-1 -left-1",
    "top-right": "absolute -top-1 -right-1",
    "top-left": "absolute -top-1 -left-1",
    inline: "relative inline-block",
  };

  const getLevelColor = (level: number) => {
    if (level <= 2) return "bg-gray-500"; // Newbie levels
    if (level <= 4) return "bg-blue-500"; // Active levels
    if (level <= 6) return "bg-purple-500"; // Expert levels
    if (level <= 8) return "bg-orange-500"; // Leader levels
    return "bg-gradient-to-r from-yellow-400 to-orange-500"; // Legend level
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${positionClasses[position]}
        ${getLevelColor(level)}
        rounded-full
        flex items-center justify-center
        text-white font-bold
        border-2 border-white
        shadow-lg
        z-10
        ${className}
      `}
      title={levelName ? `${levelName} (Level ${level})` : `Level ${level}`}
    >
      {level}
    </div>
  );
};

export default LevelBadge;
