"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, X } from "lucide-react";
import EosCreditCoin from "@/components/wallet/EosCreditCoin";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { modalZIndexClass, useModalStack } from "@/hooks/useModalStack";

export type VaultVariant = "gold" | "office";
export type VaultTone = "ok" | "warn" | "bad";

/** Okno „skarbca” dla monet EOS: czarny nagłówek z monetą i saldem, jasna treść. */
export function VaultModal({
  open,
  onClose,
  variant,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  variant: VaultVariant;
  label: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const depth = useModalStack(open);
  const ref = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className={`fixed inset-0 ${modalZIndexClass(depth > 0 ? 1 : 0)} flex items-center justify-center p-3 sm:p-6`}
          role="presentation"
          data-lenis-prevent
        >
          <button type="button" tabIndex={-1} aria-label="Zamknij okno" className="vault-backdrop cursor-default border-0 p-0" onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            data-variant={variant}
            className="vault"
            initial={{ y: 26, opacity: 0, scale: 0.965 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            data-lenis-prevent
          >
            <div className="vault__scroll custom-scrollbar" data-lenis-prevent>
              {children}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function VaultHero({
  variant,
  kicker,
  balance,
  unit,
  status,
  alert,
  loading,
  onClose,
  children,
}: {
  variant: VaultVariant;
  kicker: string;
  balance: number | null;
  unit: string;
  status?: { tone: VaultTone; text: string } | null;
  alert?: boolean;
  loading?: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <header className="vault-hero">
      <div className="vault-hero__top">
        <span className="vault-hero__kicker">{kicker}</span>
        <button type="button" className="vault-close" onClick={onClose} aria-label="Zamknij">
          <X size={16} />
        </button>
      </div>
      <div className="vault-hero__main">
        <span className="vault-hero__coin" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          <EosCreditCoin count={balance} loading={loading} spinning={hover} size="lg" variant={variant} alert={alert} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="vault-hero__balance">{loading || balance == null ? "…" : balance}</p>
          <p className="vault-hero__unit">{unit}</p>
        </div>
        {status ? <VaultStatus tone={status.tone} text={status.text} /> : null}
      </div>
      {children ? <div className="vault-hero__sub">{children}</div> : null}
    </header>
  );
}

export function VaultStatus({ tone, text }: { tone: VaultTone; text: string }) {
  return (
    <span className={`vault-status vault-status--${tone} self-start`}>
      <span className="vault-status__dot" />
      {text}
    </span>
  );
}

export function VaultSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="vault-section__title">{title}</p>
      {children}
    </section>
  );
}

export function VaultLink({
  href,
  icon,
  title,
  sub,
  warn,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <a href={href} className={`vault-link ${warn ? "vault-link--warn" : ""}`}>
      <span className="vault-link__icon">{icon}</span>
      <span className="vault-link__text">
        <span className="vault-link__title">{title}</span>
        {sub ? <span className="vault-link__sub">{sub}</span> : null}
      </span>
      <ArrowUpRight size={17} className="vault-link__arrow" />
    </a>
  );
}

export function VaultSwitch({
  title,
  sub,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  sub?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="vault-setting" onClick={() => !disabled && onChange(!checked)}>
      <span className="vault-setting__text">
        <span className="vault-setting__title">{title}</span>
        {sub ? <span className="vault-setting__sub">{sub}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        className="vault-switch"
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
      >
        <span className="vault-switch__knob" />
      </button>
    </div>
  );
}

export function VaultNotice({ tone = "info", children }: { tone?: "info" | "ok" | "warn" | "bad"; children: ReactNode }) {
  return <div className={`vault-notice vault-notice--${tone}`}>{children}</div>;
}
