"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Send } from "lucide-react";
import { eosBtn } from "@/components/ui/eosButtonStyles";

export default function SendPlaneButton({
  children,
  sending,
  className,
  disabled,
  block = true,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  sending?: boolean;
  block?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled || sending}
      className={eosBtn("home", {
        block,
        className: `eos-btn--plane ${sending ? "is-sending" : ""} ${className || ""}`.trim(),
      })}
      {...rest}
    >
      <span className="eos-send-plane__stack" aria-hidden>
        <Send className="eos-send-plane__fly size-3.5" />
        <Send className="eos-send-plane__park size-3.5" />
      </span>
      <span>{sending ? "Wysyłanie…" : children}</span>
    </button>
  );
}
