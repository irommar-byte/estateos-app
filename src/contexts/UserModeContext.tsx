"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type UserMode = "BUYER" | "SELLER" | "AGENCY";

interface UserModeContextType {
  mode: UserMode;
  selectMode: (newMode: UserMode, currentUser?: any) => void;
  forceMode: (newMode: UserMode) => void;
  initModeFromUser: (currentUser: any) => void;
  isUpgradeModalOpen: boolean;
  setIsUpgradeModalOpen: (v: boolean) => void;
  upgradeModalType: "PRO" | "AGENCY" | null;
}

const UserModeContext = createContext<UserModeContextType | undefined>(undefined);

export function UserModeProvider({ children }: { children: ReactNode }) {

  const [mode, setMode] = useState<UserMode>(() =>
    (typeof window !== "undefined" &&
      (localStorage.getItem("estateos_user_mode") as UserMode)) || "BUYER"
  );

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeModalType, setUpgradeModalType] = useState<"PRO" | "AGENCY" | null>(null);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetMode, setTargetMode] = useState<UserMode | null>(null);

  const initModeFromUser = (currentUser: any) => {
    if (!currentUser) return;

    const actualRole =
      currentUser.accountType === "SELLER"
        ? "SELLER"
        : currentUser.planType === "AGENCY"
        ? "AGENCY"
        : "BUYER";

    setMode(actualRole);
    localStorage.setItem("estateos_user_mode", actualRole);
  };

  const forceMode = (newMode: UserMode) => {
    setMode(newMode);
    localStorage.setItem("estateos_user_mode", newMode);
    window.location.reload();
  };

  const selectMode = (newMode: UserMode, currentUser?: any) => {
    if (!currentUser) return;

    // 🔥 AGENCY tylko dla planu AGENCY
    if (newMode === "AGENCY" && currentUser.planType !== "AGENCY") {
      return;
    }

    if (isTransitioning || mode === newMode) return;

    setTargetMode(newMode);
    setIsTransitioning(true);

    setTimeout(() => {
      setMode(newMode);
      localStorage.setItem("estateos_user_mode", newMode);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("userModeChanged"));
      }
    }, 300);

    setTimeout(() => {
      setIsTransitioning(false);
      setTargetMode(null);
    }, 800);
  };

  return (
    <UserModeContext.Provider
      value={{
        mode,
        selectMode,
        forceMode,
        initModeFromUser,
        isUpgradeModalOpen,
        setIsUpgradeModalOpen,
        upgradeModalType,
      }}
    >
      {children}
    </UserModeContext.Provider>
  );
}

export const useUserMode = () => {
  const context = useContext(UserModeContext);
  if (!context) {
  return {
    mode: "BUYER",
    selectMode: () => {},
    forceMode: () => {},
    initModeFromUser: () => {},
    isUpgradeModalOpen: false,
    setIsUpgradeModalOpen: () => {},
    upgradeModalType: null
  } as any;
  }

  return context;
};
