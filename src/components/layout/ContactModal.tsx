"use client";

import { useState, useEffect, FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, Send, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const TOPICS = [
  "topicGeneral",
  "topicSupport",
  "topicListing",
  "topicPartnership",
  "topicOther",
] as const;

export default function ContactModal({ isOpen, onClose }: Props) {
  const { dict } = useLocale();
  const c = dict.contact;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("topicGeneral");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [mailtoFallback, setMailtoFallback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEsc);
    };
  }, [isOpen, onClose]);

  const topicLabel = (key: (typeof TOPICS)[number]) => {
    const map: Record<(typeof TOPICS)[number], string> = {
      topicGeneral: c.topicGeneral,
      topicSupport: c.topicSupport,
      topicListing: c.topicListing,
      topicPartnership: c.topicPartnership,
      topicOther: c.topicOther,
    };
    return map[key];
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMailtoFallback(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          topic: topicLabel(topic),
          message,
          website: "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setName("");
        setEmail("");
        setMessage("");
        return;
      }
      if (data.fallbackMailto && data.mailto) {
        setMailtoFallback(data.mailto);
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999999] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-3xl sm:p-6 dark:bg-black/80"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 16 }}
          onClick={(e) => e.stopPropagation()}
          className="eos-themed-modal relative my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-strong)]"
        >
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/15 blur-[100px]" />

          <div className="relative border-b border-white/5 p-6 sm:p-8">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={c.close}
            >
              <X size={20} />
            </button>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <Mail size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">{c.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{c.subtitle}</p>
                <a
                  href={`mailto:${c.emailTo}`}
                  className="mt-3 inline-block text-xs font-semibold uppercase tracking-widest text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  {c.emailTo}
                </a>
              </div>
            </div>
          </div>

          <div className="relative p-6 sm:p-8">
            {status === "success" ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <CheckCircle2 className="text-emerald-400" size={48} />
                <p className="text-sm leading-relaxed text-white/70">{c.success}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 rounded-xl border border-white/10 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white/70 transition-colors hover:border-white/20 hover:text-white"
                >
                  {c.close}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="hidden" aria-hidden>
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/40">
                    {c.name}
                  </span>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={c.namePlaceholder}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/40">
                    {c.email}
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={c.emailPlaceholder}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/40">
                    {c.topic}
                  </span>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value as (typeof TOPICS)[number])}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  >
                    {TOPICS.map((t) => (
                      <option key={t} value={t} className="bg-[#111]">
                        {topicLabel(t)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-white/40">
                    {c.message}
                  </span>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={c.messagePlaceholder}
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  />
                </label>

                {status === "error" && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200/90">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <span>{c.error}</span>
                  </div>
                )}

                {mailtoFallback && (
                  <a
                    href={mailtoFallback}
                    className="block text-center text-xs font-semibold uppercase tracking-widest text-emerald-400 hover:text-emerald-300"
                  >
                    {c.fallbackMailto}
                  </a>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-white shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-500 disabled:opacity-60"
                >
                  <Send size={16} />
                  {status === "sending" ? c.sending : c.send}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
