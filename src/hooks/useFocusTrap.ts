"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus inside a container while active.
 * Returns a ref to attach to the dialog root element.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  options?: { returnFocusRef?: RefObject<HTMLElement | null> },
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );

    const timer = window.setTimeout(() => {
      const first = focusables()[0];
      if (first) first.focus();
      else container.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      container.removeEventListener("keydown", onKeyDown);
      const returnRef = options?.returnFocusRef?.current;
      const prev = previousFocusRef.current;
      if (returnRef && document.contains(returnRef)) {
        returnRef.focus();
      } else if (prev && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [active, options?.returnFocusRef]);

  return containerRef;
}
