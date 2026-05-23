"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

/**
 * Jednolite konto jak w aplikacji mobilnej — bez przełącznika Kupujący / Sprzedający / Inwestor.
 * Wartość `APP` jest zachowana dla kompatybilności z istniejącym kodem CRM.
 */
type UserMode = "APP";

interface UserModeContextType {
  mode: UserMode;
  selectMode: (newMode: UserMode, currentUser?: unknown) => void;
  forceMode: (newMode: UserMode) => void;
  initModeFromUser: (currentUser: unknown) => void;
  isUpgradeModalOpen: boolean;
  setIsUpgradeModalOpen: (v: boolean) => void;
  upgradeModalType: "PRO" | "AGENCY" | null;
}

const UserModeContext = createContext<UserModeContextType | undefined>(undefined);

export function UserModeProvider({ children }: { children: ReactNode }) {
  const [mode] = useState<UserMode>("APP");
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeModalType, setUpgradeModalType] = useState<"PRO" | "AGENCY" | null>(null);

  const initModeFromUser = useCallback((_currentUser?: unknown) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("estateos_user_mode", "APP");
    }
  }, []);

  const forceMode = (_newMode: UserMode) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("estateos_user_mode", "APP");
    }
  };

  const selectMode = (_newMode: UserMode, _currentUser?: unknown) => {
    /* Brak przełączania trybów — zgodnie z aplikacją mobilną. */
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
      mode: "APP" as UserMode,
      selectMode: () => {},
      forceMode: () => {},
      initModeFromUser: () => {},
      isUpgradeModalOpen: false,
      setIsUpgradeModalOpen: () => {},
      upgradeModalType: null,
    };
  }
  return context;
};
