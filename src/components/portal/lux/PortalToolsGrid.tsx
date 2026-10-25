"use client";

import type { LucideIcon } from "lucide-react";

export type LuxTool = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  badge?: string | null;
};

export default function PortalToolsGrid({ kicker, title, tools }: { kicker: string; title: string; tools: LuxTool[] }) {
  if (!tools.length) return null;
  return (
    <section>
      <p className="lux-kicker">{kicker}</p>
      <h2 className="lux-serif mt-1.5 text-[24px] font-medium leading-tight">{title}</h2>
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.key}
              type="button"
              onClick={tool.onClick}
              className="lux-card lux-card--gold flex min-h-[118px] flex-col gap-2 p-4 text-left transition hover:-translate-y-0.5"
            >
              <span className="flex items-center justify-between">
                <Icon className="size-5 text-[var(--lux-accent)]" aria-hidden />
                {tool.badge ? (
                  <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-[#D8C3A0]">{tool.badge}</span>
                ) : null}
              </span>
              <span className="text-[14px] font-bold text-[var(--lux-ink)]">{tool.title}</span>
              <span className="text-[12px] leading-snug text-[var(--lux-ink-2)]">{tool.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
