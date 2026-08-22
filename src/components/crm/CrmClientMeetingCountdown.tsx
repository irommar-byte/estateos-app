"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { splitCountdown } from "@/lib/crm/upcomingScheduleShared";

type Props = {
  startsAt: string;
  location?: string | null;
};

export default function CrmClientMeetingCountdown({ startsAt, location }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const state = useMemo(() => {
    const start = new Date(startsAt).getTime();
    if (Number.isNaN(start)) return null;
    const end = start + 60 * 60 * 1000;
    if (now > end) return null;
    if (now >= start) return { kind: "live" as const };
    return { kind: "upcoming" as const, parts: splitCountdown(start - now) };
  }, [now, startsAt]);

  if (!state) return null;

  if (state.kind === "live") {
    return (
      <div className="eos-crm-meeting-countdown eos-crm-meeting-countdown--live">
        <CalendarClock className="size-3.5 shrink-0" aria-hidden />
        <span>Spotkanie teraz</span>
      </div>
    );
  }

  const { parts } = state;
  const compact =
    parts.days > 0
      ? `${parts.days}d ${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}`
      : `${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}:${String(parts.seconds).padStart(2, "0")}`;

  return (
    <div className="eos-crm-meeting-countdown" title={location || undefined}>
      <CalendarClock className="size-3.5 shrink-0 text-sky-600" aria-hidden />
      <span className="eos-crm-meeting-countdown__label">Spotkanie za</span>
      <span className="eos-crm-meeting-countdown__time tabular-nums">{compact}</span>
    </div>
  );
}
