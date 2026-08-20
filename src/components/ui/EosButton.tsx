"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { eosBtn, type EosBtnSize, type EosBtnVariant } from "@/components/ui/eosButtonStyles";

type CommonProps = {
  variant?: EosBtnVariant;
  size?: EosBtnSize;
  block?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps & {
  href: string;
  type?: never;
  disabled?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
};

export type EosButtonProps = ButtonAsButton | ButtonAsLink;

export default function EosButton(props: EosButtonProps) {
  const { variant = "primary", size = "md", block, className, children } = props;
  const classes = eosBtn(variant, { size, block, className });

  if ("href" in props && props.href) {
    const { href, disabled } = props;
    if (disabled) {
      return (
        <span className={`${classes} pointer-events-none opacity-70`} aria-disabled>
          {children}
        </span>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  const { type = "button", ...rest } = props as ButtonAsButton;
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
