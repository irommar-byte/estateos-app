"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

export type KeiTargetUserOption = { id: number; name: string; email: string; role: string; companyName?: string | null };

const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrator", AGENT: "Agent", USER: "Konto Pro" };

/** Wybór konta docelowego importu po nazwisku lub e-mailu — zamiast wpisywania numeru ID. */
export default function KeiTargetUserPicker(props: {
  value: number | null;
  selected?: { id: number; name: string | null; email: string; role?: string } | null;
  onChange: (user: KeiTargetUserOption) => void;
  endpoint?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<KeiTargetUserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setCurrent] = useState<KeiTargetUserOption | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current: KeiTargetUserOption | null =
    picked ??
    (props.selected
      ? {
          id: props.selected.id,
          name: props.selected.name || props.selected.email,
          email: props.selected.email,
          role: props.selected.role || "",
        }
      : null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`${props.endpoint || "/api/admin/kei-amer/target-users"}?q=${encodeURIComponent(query)}`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => setOptions(Array.isArray(data?.users) ? data.users : []))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, props.endpoint]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="k-field flex items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={props.disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 truncate">
          {current ? (
            <>
              <span className="font-semibold">{current.name}</span>
              <span className="text-[color:var(--k-ink-3)]"> · {current.email}</span>
            </>
          ) : props.value ? (
            <span className="text-[color:var(--k-ink-3)]">Konto #{props.value}</span>
          ) : (
            <span className="text-[color:var(--k-ink-3)]">Wybierz agenta</span>
          )}
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-[color:var(--k-ink-3)]" />
      </button>
      {open ? (
        <div className="k-card absolute left-0 right-0 top-[calc(100%+6px)] z-30 p-2">
          <label className="flex items-center gap-2 rounded-[10px] bg-[color:var(--k-well)] px-3">
            <Search size={14} className="text-[color:var(--k-ink-3)]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj po nazwisku, e-mailu lub firmie"
              className="h-9 w-full bg-transparent text-[13px] text-[color:var(--k-ink)] outline-none placeholder:text-[color:var(--k-ink-3)]"
            />
          </label>
          <ul id={listId} role="listbox" className="k-scroll mt-2 max-h-64 overflow-y-auto">
            {loading && options.length === 0 ? (
              <li className="px-3 py-3 text-[12.5px] text-[color:var(--k-ink-3)]">Szukam…</li>
            ) : null}
            {!loading && options.length === 0 ? (
              <li className="px-3 py-3 text-[12.5px] text-[color:var(--k-ink-3)]">Brak pasujących kont.</li>
            ) : null}
            {options.map((user) => {
              const selected = user.id === (current?.id ?? props.value);
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--k-neutral-soft)]"
                    onClick={() => {
                      setCurrent(user);
                      props.onChange(user);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-[color:var(--k-ink)]">{user.name}</span>
                      <span className="block truncate text-[12px] text-[color:var(--k-ink-3)]">
                        {user.email}
                        {user.companyName ? ` · ${user.companyName}` : ""} · {ROLE_LABEL[user.role] || user.role}
                      </span>
                    </span>
                    {selected ? <Check size={15} className="shrink-0 text-[color:var(--k-gold-ink)]" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
