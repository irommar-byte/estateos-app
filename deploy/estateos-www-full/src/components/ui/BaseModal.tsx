"use client";
import { useEffect, ReactNode } from "react";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxWidth?: string;
}

export default function BaseModal({ isOpen, onClose, children, title, maxWidth = "max-w-2xl" }: BaseModalProps) {
  // Blokada scrollowania tła i nasłuchiwanie klawisza ESC
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", handleEsc);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleEsc);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    // Warstwa tła z ekstremalnie wysokim z-index, aby przykryć absolutnie wszystko
    <div 
      className="fixed inset-0 z-[999999] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-4 sm:p-6 transition-opacity" 
      onClick={onClose}
    >
      {/* Kontener modala - items-start w rodzicu i my-auto tutaj zapobiega ucinaniu od góry przy wysokich modalach */}
      <div 
        className={`relative w-full ${maxWidth} bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl my-auto transform transition-all flex flex-col max-h-[90vh]`} 
        onClick={(e) => e.stopPropagation()} // Blokada propagacji (zapobiega znikaniu po kliknięciu w środek)
      >
        {/* Nagłówek modala (jeśli istnieje) lub sam przycisk X */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/5 bg-[#050505] shrink-0">
          {title ? (
            <h3 className="text-xl font-semibold text-white">{title}</h3>
          ) : (
            <div></div> // Pusty div dla flex-between jeśli nie ma tytułu
          )}
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
            aria-label="Zamknij"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Dynamiczna treść modala z własnym, wewnętrznym paskiem przewijania */}
        <div className="p-4 sm:p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
