"use client";

import { X } from "lucide-react";
import { useEffect, ReactNode } from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  maxHeight?: string;
}

export default function SettingsModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-6xl",
  maxHeight = "max-h-[90vh]",
}: SettingsModalProps) {
  // Close modal when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent scrolling of the background when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Modal backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4"
        onClick={onClose}
      >
        {/* Modal content */}
        <div
          className={`bg-base-100 rounded-lg shadow-xl w-full ${maxWidth} ${maxHeight} flex flex-col settings-modal overflow-hidden`}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
          {/* Modal header */}
          <div className="flex items-center justify-between p-6 border-b border-base-300">
            <h2 className="text-2xl font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle"
              aria-label="Close"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal body */}
          <div className="flex-1 flex flex-col min-h-0">{children}</div>
        </div>
      </div>
    </>
  );
}
