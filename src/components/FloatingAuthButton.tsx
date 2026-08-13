"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, ShieldAlert } from "lucide-react";
import { eosBtn } from "@/components/ui/eosButtonStyles";

export default function FloatingAuthButton() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/user/profile', {
          cache: 'no-store',
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && (data?.id || data?.user?.id)) setUser(data);
        else setUser(null);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading || !user) return null;

  const isAdmin = user.role === 'ADMIN';

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 50, x: "-50%" }} 
        animate={{ opacity: 1, y: 0, x: "-50%" }} 
        exit={{ opacity: 0, y: 50, x: "-50%" }}
        className="fixed bottom-10 left-1/2 z-50 pointer-events-auto"
      >
        <a 
          href={isAdmin ? "/centrala" : "/moje-konto"} 
          className={eosBtn(isAdmin ? "danger" : "home", {
            size: "lg",
            className: "shadow-[0_20px_50px_rgba(0,0,0,0.35)]",
          })}
        >
          {isAdmin ? <ShieldAlert size={20} /> : <User size={20} />}
          <span>{isAdmin ? "Centrala Dowodzenia" : "Panel Klienta"}</span>
        </a>
      </motion.div>
    </AnimatePresence>
  );
}
