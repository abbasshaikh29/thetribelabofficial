"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import UserSettingsModal from "./UserSettingsModal";
import CommunitySettingsModal from "./CommunitySettingsModal";

interface SettingsModalContextType {
  openUserSettings: (initialTab?: string) => void;
  openCommunitySettings: (slug?: string, initialTab?: string) => void;
  openSettingsModal: (tab?: string, slug?: string) => void; // Unified method
  closeModals: () => void;
  isUserSettingsOpen: boolean;
  isCommunitySettingsOpen: boolean;
}

const SettingsModalContext = createContext<SettingsModalContextType | undefined>(undefined);

export const useSettingsModal = () => {
  const context = useContext(SettingsModalContext);
  if (!context) {
    throw new Error("useSettingsModal must be used within a SettingsModalProvider");
  }
  return context;
};

interface SettingsModalProviderProps {
  children: ReactNode;
}

export default function SettingsModalProvider({ children }: SettingsModalProviderProps) {
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isCommunitySettingsOpen, setIsCommunitySettingsOpen] = useState(false);
  const [userSettingsTab, setUserSettingsTab] = useState("UserSettings");
  const [communitySettingsTab, setCommunitySettingsTab] = useState("UserSettings");
  const [communitySlug, setCommunitySlug] = useState<string | undefined>();

  const openUserSettings = (initialTab = "UserSettings") => {
    setUserSettingsTab(initialTab);
    setIsUserSettingsOpen(true);
    // Close community settings if open
    setIsCommunitySettingsOpen(false);
  };

  const openCommunitySettings = (slug?: string, initialTab = "UserSettings") => {
    setCommunitySlug(slug);
    setCommunitySettingsTab(initialTab);
    setIsCommunitySettingsOpen(true);
    // Close user settings if open
    setIsUserSettingsOpen(false);
  };

  // Unified method for opening settings modals
  const openSettingsModal = (tab = "UserSettings", slug?: string) => {
    if (slug) {
      // Open community settings
      openCommunitySettings(slug, tab);
    } else {
      // Open user settings
      openUserSettings(tab);
    }
  };

  const closeModals = () => {
    setIsUserSettingsOpen(false);
    setIsCommunitySettingsOpen(false);
  };

  const contextValue: SettingsModalContextType = {
    openUserSettings,
    openCommunitySettings,
    openSettingsModal,
    closeModals,
    isUserSettingsOpen,
    isCommunitySettingsOpen,
  };

  return (
    <SettingsModalContext.Provider value={contextValue}>
      {children}
      
      {/* Render modals */}
      <UserSettingsModal
        isOpen={isUserSettingsOpen}
        onClose={closeModals}
        initialTab={userSettingsTab}
      />
      
      <CommunitySettingsModal
        isOpen={isCommunitySettingsOpen}
        onClose={closeModals}
        initialTab={communitySettingsTab}
        slug={communitySlug}
      />
    </SettingsModalContext.Provider>
  );
}
