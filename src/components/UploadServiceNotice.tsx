"use client";

import React from "react";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";

interface UploadServiceNoticeProps {
  onRetry?: () => void;
  showRetry?: boolean;
}

export default function UploadServiceNotice({ onRetry, showRetry = true }: UploadServiceNoticeProps) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-800 mb-2">
            Upload Service Temporarily Unavailable
          </h3>
          <div className="text-sm text-yellow-700 space-y-2">
            <p>
              We're experiencing technical difficulties with our image upload service due to an SSL connectivity issue with our storage provider (Cloudflare R2).
            </p>
            <div className="bg-yellow-100 rounded p-3 mt-3">
              <div className="flex items-start">
                <Info className="w-4 h-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-xs text-yellow-700">
                  <p className="font-medium mb-1">What you can do:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Try again in a few minutes - the issue may resolve automatically</li>
                    <li>If you have an image hosted elsewhere, you can manually enter the URL</li>
                    <li>Contact support if the issue persists</li>
                  </ul>
                </div>
              </div>
            </div>
            {showRetry && onRetry && (
              <div className="mt-3">
                <button
                  onClick={onRetry}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded hover:bg-yellow-200 transition-colors"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
