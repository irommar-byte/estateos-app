"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Paperclip, Plus, Radio, Send, X } from "lucide-react";
import ContactAttachmentBubble from "@/components/contact/ContactAttachmentBubble";
import {
  cleanAttachmentOnlyMessage,
  formatContactAttachmentName,
  formatContactBytes,
  type ContactAttachmentMeta,
} from "@/lib/contactAttachmentShared";
import SendPlaneButton from "@/components/ui/SendPlaneButton";

type PortalMessage = {
  id: number;
  content: string;
  createdAt: string;
  fromMe: boolean;
  kind?: "chat" | "client_step" | "agent_note" | "checkback";
  offerTitle?: string | null;
  sentiment?: string | null;
  attachments?: ContactAttachmentMeta[];
};

export default function CrmClientLiveChat({
  clientId,
  clientName,
  className = "",
}: {
  clientId: number;
  clientName: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const openRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);

  const markRead = useCallback(async () => {
    setUnreadCount(0);
    await fetch(`/api/crm/clients/${clientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_portal_messages_read" }),
    }).catch(() => {});
  }, [clientId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/clients/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "list_portal_messages" }),
      });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.messages)) return;
      setMessages(json.messages);
      setPeerTyping(Boolean(json.peerTyping));
      if (openRef.current) {
        if (Number(json.unreadCount) > 0) void markRead();
        else setUnreadCount(0);
      } else {
        setUnreadCount(Math.max(0, Number(json.unreadCount) || 0));
      }
    } catch {
      /* chwilowa utrata sieci nie czyści rozmowy */
    }
  }, [clientId, markRead]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  useEffect(() => {
    openRef.current = open;
    const timer = window.setInterval(() => void load(), open ? 2_000 : 5_000);
    return () => window.clearInterval(timer);
  }, [load, open]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages.length, open, peerTyping]);

  const openChat = () => {
    openRef.current = true;
    setOpen(true);
    void markRead();
    void load();
  };

  const pingTyping = () => {
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      void fetch(`/api/crm/clients/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal_typing" }),
      });
    }, 280);
  };

  const send = async () => {
    const content = draft.trim();
    if (busy || (!content && !pendingFile)) return;
    setBusy(true);
    setError("");
    try {
      let attachments: ContactAttachmentMeta[] = [];
      if (pendingFile) {
        const form = new FormData();
        form.append("file", pendingFile);
        const upload = await fetch(`/api/crm/clients/${clientId}/portal-attachments`, {
          method: "POST",
          body: form,
        });
        const uploadJson = await upload.json();
        if (!upload.ok) throw new Error(uploadJson.error || "Nie udało się wgrać załącznika.");
        attachments = [uploadJson.attachment];
      }
      const res = await fetch(`/api/crm/clients/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_portal_message", content, attachments }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się wysłać wiadomości.");
      setDraft("");
      setPendingFile(null);
      await load();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Nie udało się wysłać wiadomości.");
    } finally {
      setBusy(false);
    }
  };

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 eos-z-modal-nested flex items-end justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:items-center">
            <section className="flex max-h-[min(760px,90svh)] w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] border border-emerald-500/25 bg-[var(--eos-card)] shadow-[0_30px_100px_rgba(0,0,0,0.38)]">
              <header className="flex items-center justify-between border-b border-[var(--eos-border)] bg-gradient-to-r from-emerald-500/12 to-transparent px-5 py-4">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-red-500">
                    <Radio className="size-3 animate-pulse" />
                    Live Chat · Panel klienta
                  </p>
                  <h3 className="truncate text-base font-black text-[var(--eos-text)]">{clientName}</h3>
                  <p className="text-[11px] text-[var(--eos-muted)]">
                    Klient widzi tylko rozmowę i konkretne kroki. Żółte notatki zostają u Ciebie.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    openRef.current = false;
                    setOpen(false);
                  }}
                  className="rounded-full p-2 text-[var(--eos-muted)] hover:bg-[var(--eos-input)]"
                  aria-label="Zamknij czat"
                >
                  <X className="size-5" />
                </button>
              </header>

              <div
                ref={listRef}
                data-lenis-prevent
                className="min-h-[260px] flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:min-h-[380px]"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <MessageSquare className="size-9 text-emerald-500/50" />
                    <p className="mt-3 text-sm font-bold text-[var(--eos-text)]">Napisz pierwszą wiadomość</p>
                    <p className="mt-1 text-xs text-[var(--eos-muted)]">
                      Klient zobaczy ją w wyróżnionym kafelku Live Chat i dostanie powiadomienie.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const visibleContent = cleanAttachmentOnlyMessage(message.content, message.attachments);
                    const isAgentNote = message.kind === "agent_note";
                    const isStep = message.kind === "client_step" || message.kind === "checkback";
                    return (
                      <div
                      key={message.id}
                      className={`max-w-[86%] rounded-2xl px-3 py-2.5 text-sm ${
                        isAgentNote
                          ? "ml-auto border border-amber-400/40 bg-amber-500/12"
                          : message.fromMe
                            ? "ml-auto bg-emerald-500/16"
                            : "mr-auto border border-[var(--eos-border)] bg-[var(--eos-input)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-[var(--eos-muted)]">
                          {isAgentNote
                            ? "Tylko Ty · instrukcja"
                            : isStep && message.fromMe
                              ? "Klient to widzi"
                              : message.fromMe
                                ? "Ty"
                                : clientName}
                        </p>
                        <time className="text-[9px] text-[var(--eos-muted)]">
                          {new Date(message.createdAt).toLocaleString("pl-PL", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      {message.offerTitle ? (
                        <p className="mt-1 text-[10px] font-semibold text-[var(--eos-muted)]">
                          Oferta · {message.offerTitle}
                        </p>
                      ) : null}
                      {visibleContent ? <p className="mt-1 whitespace-pre-wrap leading-relaxed">{visibleContent}</p> : null}
                      {(message.attachments || []).map((attachment) => (
                        <ContactAttachmentBubble key={attachment.url} attachment={attachment} isMe={message.fromMe} />
                      ))}
                      </div>
                    );
                  })
                )}
                {peerTyping ? (
                  <div className="mr-auto inline-flex items-center gap-1 rounded-full bg-[var(--eos-input)] px-3 py-2">
                    <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.2s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-emerald-500" />
                    <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:0.2s]" />
                  </div>
                ) : null}
              </div>

              {pendingFile ? (
                <div className="eos-inset-well mx-4 mb-2 flex items-center gap-3 rounded-2xl px-4 py-2.5">
                  <Paperclip className="size-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{formatContactAttachmentName(pendingFile.name)}</p>
                    <p className="text-[10px] text-[var(--eos-muted)]">{formatContactBytes(pendingFile.size)}</p>
                  </div>
                  <button type="button" onClick={() => setPendingFile(null)} className="rounded-full p-1.5 text-[var(--eos-muted)]">
                    <X className="size-4" />
                  </button>
                </div>
              ) : null}
              {error ? <p className="px-4 pb-2 text-xs font-semibold text-red-500">{error}</p> : null}

              <footer className="flex gap-2 border-t border-[var(--eos-border)] p-3 sm:p-4">
                <label className="eos-inset-well flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--eos-muted)] hover:text-emerald-600">
                  <Plus className="size-5" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                <input
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    pingTyping();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Wiadomość do klienta…"
                  className="eos-field-inset min-w-0 flex-1 rounded-xl px-4 py-3 text-sm text-[var(--eos-text)]"
                />
                <SendPlaneButton
                  sending={busy}
                  block={false}
                  disabled={busy || (!draft.trim() && !pendingFile)}
                  onClick={() => void send()}
                  className="shrink-0 px-4"
                >
                  <span className="hidden sm:inline">Wyślij</span>
                  <Send className="size-4 sm:hidden" />
                </SendPlaneButton>
              </footer>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button type="button" onClick={openChat} className={`relative ${className}`}>
        <MessageSquare className="size-3.5" />
        Live Chat z klientem
        {unreadCount > 0 ? (
          <span className="ml-1 inline-flex min-w-5 animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-5 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {modal}
    </>
  );
}
