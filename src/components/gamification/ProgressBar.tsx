"use client";

import React from "react";

interface ProgressBarProps {
  currentPoints: number;
  pointsToNext: number;
  progress: number; // 0-100
  currentLevelName: string;
  nextLevelName?: string;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  currentPoints,
  pointsToNext,
  progress,
  currentLevelName,
  nextLevelName,
  className = "",
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {currentLevelName}
        </span>
        {nextLevelName && (
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {pointsToNext} to {nextLevelName}
          </span>
        )}
      </div>
      
      <div className="w-full rounded-full h-2.5" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
        <div
          className="h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${Math.min(progress, 100)}%`,
            background: 'linear-gradient(to right, var(--brand-primary), var(--brand-secondary))'
          }}
        ></div>
      </div>
      
      <div className="flex justify-between items-center mt-1">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {currentPoints} points
        </span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {progress}%
        </span>
      </div>
    </div>
  );
};

export default ProgressBar;
