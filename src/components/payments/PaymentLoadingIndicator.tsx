"use client";

import { useState, useEffect } from "react";

interface PaymentLoadingIndicatorProps {
  isVisible: boolean;
  message?: string;
  onTimeout?: () => void;
  timeoutMs?: number;
}

export default function PaymentLoadingIndicator({
  isVisible,
  message = "Processing your payment...",
  onTimeout,
  timeoutMs = 45000 // Increased to 45 seconds to match new retry logic
}: PaymentLoadingIndicatorProps) {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setTimeElapsed(0);
      setShowTimeoutWarning(false);
      return;
    }

    const interval = setInterval(() => {
      setTimeElapsed(prev => {
        const newTime = prev + 1000;
        
        // Show warning at 20 seconds
        if (newTime >= 20000 && !showTimeoutWarning) {
          setShowTimeoutWarning(true);
        }
        
        // Trigger timeout callback
        if (newTime >= timeoutMs && onTimeout) {
          onTimeout();
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, timeoutMs, onTimeout, showTimeoutWarning]);

  if (!isVisible) return null;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
        {/* Loading Spinner */}
        <div className="flex justify-center mb-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
        
        {/* Main Message */}
        <h3 className="text-lg font-semibold mb-2">{message}</h3>
        
        {/* Time Elapsed */}
        <p className="text-sm text-gray-600 mb-4">
          Time elapsed: {formatTime(timeElapsed)}
        </p>
        
        {/* Progress Steps */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm">Payment initiated</span>
          </div>

          <div className="flex items-center justify-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${timeElapsed > 3000 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <span className="text-sm">Verifying signature</span>
          </div>

          <div className="flex items-center justify-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${timeElapsed > 8000 ? 'bg-green-500' : timeElapsed > 3000 ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="text-sm">Updating subscription</span>
          </div>

          <div className="flex items-center justify-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${timeElapsed > 15000 ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="text-sm">Finalizing setup</span>
          </div>
        </div>
        
        {/* Timeout Warning */}
        {showTimeoutWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Payment verification is taking longer than usual. We're automatically retrying to ensure your payment is processed correctly.
              Please don't close this window.
            </p>
          </div>
        )}

        {/* Tips */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Please don't refresh or close this page</p>
          <p>• Your payment is being processed securely</p>
          <p>• We'll automatically retry if there are any delays</p>
          <p>• You'll be redirected automatically when complete</p>
        </div>
      </div>
    </div>
  );
}
