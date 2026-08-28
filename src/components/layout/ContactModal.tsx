"use client";

import { useState, FormEvent } from "react";
import { Send, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";
import { eosBtn } from "@/components/ui/eosButtonStyles";
import EosModal from "@/components/ui/EosModal";

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

const fieldClass =
  "eos-modal-field w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-4 py-3 text-sm text-[var(--eos-text)] placeholder:text-[var(--eos-subtle)] outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30";

export default function ContactModal({ isOpen, onClose }: Props) {
  const { dict } = useLocale();
  const c = dict.contact;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<(typeof TOPICS)[number]>("topicGeneral");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [mailtoFallback, setMailtoFallback] = useState<string | null>(null);

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

  return (
    <EosModal
      open={isOpen}
      onClose={onClose}
      variant="centered"
      maxWidth="max-w-lg"
      title={c.title}
      subtitle={c.subtitle}
      icon={<Mail size={22} />}
      hideBodyPadding
    >
      <div className="px-6 pb-6 sm:px-8 sm:pb-8">
        <a
          href={`mailto:${c.emailTo}`}
          className="mb-6 inline-block text-xs font-semibold uppercase tracking-widest text-emerald-600 transition-colors hover:text-emerald-500"
        >
          {c.emailTo}
        </a>

        {status === "success" ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="text-emerald-500" size={48} />
            <p className="text-sm leading-relaxed text-[var(--eos-muted)]">{c.success}</p>
            <button type="button" onClick={onClose} className={eosBtn("secondary")}>
              {c.close}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="hidden" aria-hidden>
              <input name="website" tabIndex={-1} autoComplete="off" />
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">
                {c.name}
              </span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={c.namePlaceholder}
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">
                {c.email}
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={c.emailPlaceholder}
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">
                {c.topic}
              </span>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value as (typeof TOPICS)[number])}
                className={fieldClass}
              >
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {topicLabel(t)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-[var(--eos-subtle)]">
                {c.message}
              </span>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={c.messagePlaceholder}
                className={`${fieldClass} resize-y`}
              />
            </label>

            {status === "error" && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{c.error}</span>
              </div>
            )}

            {mailtoFallback && (
              <a
                href={mailtoFallback}
                className="block text-center text-xs font-semibold uppercase tracking-widest text-emerald-600 hover:text-emerald-500"
              >
                {c.fallbackMailto}
              </a>
            )}

            <button type="submit" disabled={status === "sending"} className={eosBtn("home", { block: true, size: "lg" })}>
              <Send size={16} />
              {status === "sending" ? c.sending : c.send}
            </button>
          </form>
        )}
      </div>
    </EosModal>
  );
}
