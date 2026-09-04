"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, ChevronDown, MessageSquare, Paperclip, Plus, Radio, Send, X } from "lucide-react";
import ContactAttachmentBubble from "@/components/contact/ContactAttachmentBubble";
import {
  cleanAttachmentOnlyMessage,
  contactAttachmentPreviewLabel,
  formatContactAttachmentName,
  formatContactBytes,
  type ContactAttachmentMeta,
} from "@/lib/contactAttachmentShared";
import { showWebNotification } from "@/lib/webNotifications";
import SendPlaneButton from "@/components/ui/SendPlaneButton";

type PortalMessage = {
  id: number;
  content: string;
  createdAt: string;
  fromAgent: boolean;
  fromMe: boolean;
  attachments?: ContactAttachmentMeta[];
  checkbackQuickReplies?: {
    activityId: number;
    options: Array<{ id: string; label: string }>;
  };
};

function messageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClientPortalLiveChat({
  token,
  agentName,
}: {
  token: string;
  agentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const openRef = useRef(false);
  const initializedRef = useRef(false);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const holdTimer = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);

  const markRead = useCallback(async () => {
    if (!token) return;
    setUnreadCount(0);
    await fetch(`/api/crm/client-portal/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_messages_read" }),
    }).catch(() => {});
  }, [token]);

  const loadMessages = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action: "list_messages" }),
      });
      const json = await res.json();
      if (!res.ok || !Array.isArray(json.messages)) return;
      const nextMessages = json.messages as PortalMessage[];

      if (initializedRef.current) {
        const freshFromAgent = nextMessages.filter(
          (message) => message.fromAgent && !knownMessageIdsRef.current.has(String(message.id)),
        );
        if (freshFromAgent.length > 0 && (!openRef.current || document.hidden)) {
          const latest = freshFromAgent[freshFromAgent.length - 1];
          const visibleContent = cleanAttachmentOnlyMessage(latest.content, latest.attachments);
          showWebNotification(`Nowa wiadomość · ${agentName}`, {
            body:
              visibleContent ||
              (latest.attachments?.[0] ? contactAttachmentPreviewLabel(latest.attachments[0]) : "Nowy załącznik"),
            tag: `estateos-portal-chat-${token}`,
            onClickPath: `/klient/${token}?chat=1`,
          });
        }
      }

      for (const message of nextMessages) knownMessageIdsRef.current.add(String(message.id));
      initializedRef.current = true;
      setMessages(nextMessages);
      setPeerTyping(Boolean(json.peerTyping));
      if (openRef.current) {
        if (Number(json.unreadCount) > 0) void markRead();
        else setUnreadCount(0);
      } else {
        setUnreadCount(Math.max(0, Number(json.unreadCount) || 0));
      }
    } catch {
      /* zachowaj poprzedni stan przy chwilowej utracie sieci */
    }
  }, [agentName, markRead, token]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const shouldOpen = new URLSearchParams(window.location.search).get("chat") === "1";
    const frame = window.requestAnimationFrame(() => {
      if (shouldOpen) {
          openRef.current = true;
          setOpen(true);
          void markRead();
      }
      void loadMessages();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [loadMessages, markRead]);

  useEffect(() => {
    const delay = open ? 2_000 : 4_000;
    const timer = window.setInterval(() => void loadMessages(), delay);
    const onVisibility = () => void loadMessages();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open, loadMessages]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [open, messages.length, peerTyping]);

  const toggleOpen = () => {
    const next = !openRef.current;
    openRef.current = next;
    setOpen(next);
    if (next) {
      void markRead();
      void loadMessages();
    }
  };

  const pingTyping = () => {
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      void fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "typing" }),
      });
    }, 280);
  };

  const respondCheckback = async (activityId: number, optionId: string) => {
    if (!token || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "intelligence_checkback", activityId, optionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się wysłać odpowiedzi.");
      await loadMessages();
    } catch (respondError) {
      setError(respondError instanceof Error ? respondError.message : "Nie udało się wysłać odpowiedzi.");
    } finally {
      setBusy(false);
    }
  };

  const sendChat = async () => {
    const content = draft.trim();
    if (!token || busy || (!content && !pendingFile)) return;
    setBusy(true);
    setError("");
    try {
      let attachments: ContactAttachmentMeta[] = [];
      if (pendingFile) {
        const payload = new FormData();
        payload.append("file", pendingFile);
        const upload = await fetch(`/api/crm/client-portal/${token}/attachments`, {
          method: "POST",
          body: payload,
        });
        const uploadJson = await upload.json();
        if (!upload.ok) throw new Error(uploadJson.error || "Nie udało się wgrać załącznika.");
        attachments = [uploadJson.attachment];
      }
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_message", content, attachments }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się wysłać wiadomości.");
      if (json.needsCheckbackChoice) {
        setError("Wybierz proszę jedną z opcji odpowiedzi poniżej.");
      } else {
        setError("");
      }
      setDraft("");
      setPendingFile(null);
      await loadMessages();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Nie udało się wysłać wiadomości.");
    } finally {
      setBusy(false);
    }
  };

  const copyMessage = async (message: PortalMessage) => {
    const text =
      cleanAttachmentOnlyMessage(message.content, message.attachments) ||
      (message.attachments || []).map((attachment) => formatContactAttachmentName(attachment.name)).join(", ");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1_400);
    } catch {
      /* schowek może być zablokowany */
    }
  };

  const latestMessage = messages[messages.length - 1];
  const latestVisibleContent = latestMessage
    ? cleanAttachmentOnlyMessage(latestMessage.content, latestMessage.attachments)
    : "";

  return (
    <section
      className={`relative overflow-hidden rounded-[1.45rem] border transition-all duration-300 ${
        unreadCount > 0
          ? "border-emerald-400/70 bg-gradient-to-r from-emerald-500/16 via-emerald-400/8 to-cyan-400/10 shadow-[0_16px_45px_rgba(16,185,129,0.22)]"
          : "border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 to-[var(--eos-card)] shadow-[0_12px_36px_rgba(0,0,0,0.08)]"
      }`}
    >
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className={`relative flex w-full items-center gap-3 p-4 text-left sm:p-5 ${
          unreadCount > 0 ? "animate-[pulse_1.8s_ease-in-out_infinite]" : ""
        }`}
      >
        <div className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-black shadow-[0_8px_22px_rgba(16,185,129,0.35)]">
          <MessageSquare className="size-5" />
          {unreadCount > 0 ? (
            <>
              <span className="absolute -right-1 -top-1 size-3 animate-ping rounded-full bg-red-500" />
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-5 text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white shadow-sm">
              <Radio className="size-3 animate-pulse" />
              Live Chat
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Bezpośrednio z {agentName}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-black text-[var(--eos-text)]">
            {unreadCount > 0
              ? `${unreadCount} ${unreadCount === 1 ? "nowa wiadomość" : "nowe wiadomości"}`
              : latestMessage
                ? latestVisibleContent ||
                  (latestMessage.attachments?.[0]
                    ? contactAttachmentPreviewLabel(latestMessage.attachments[0])
                    : "Załącznik")
                : "Napisz — agent dostanie powiadomienie od razu"}
          </p>
        </div>
        {unreadCount > 0 ? <BellRing className="size-5 shrink-0 animate-bounce text-red-500" /> : null}
        <ChevronDown
          className={`size-5 shrink-0 text-[var(--eos-muted)] transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="border-t border-emerald-500/20 bg-[var(--eos-bg)]/75 backdrop-blur-xl">
          <div
            ref={listRef}
            data-lenis-prevent
            className="h-[min(330px,46svh)] space-y-2 overflow-y-auto overscroll-contain px-3 py-4 [-webkit-overflow-scrolling:touch] sm:px-5"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageSquare className="size-8 text-emerald-500/60" />
                <p className="mt-3 text-sm font-bold text-[var(--eos-text)]">Tu zaczyna się Wasza rozmowa</p>
                <p className="mt-1 max-w-sm text-xs text-[var(--eos-muted)]">
                  Wiadomość pojawi się agentowi w CRM, a odpowiedź wróci dokładnie tutaj.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const visibleContent = cleanAttachmentOnlyMessage(message.content, message.attachments);
                return (
                  <div
                  key={message.id}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    void copyMessage(message);
                  }}
                  onPointerDown={() => {
                    holdTimer.current = window.setTimeout(() => void copyMessage(message), 520);
                  }}
                  onPointerUp={() => {
                    if (holdTimer.current) window.clearTimeout(holdTimer.current);
                  }}
                  onPointerCancel={() => {
                    if (holdTimer.current) window.clearTimeout(holdTimer.current);
                  }}
                  onPointerLeave={() => {
                    if (holdTimer.current) window.clearTimeout(holdTimer.current);
                  }}
                  className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm shadow-sm ${
                    message.fromMe
                      ? "ml-auto bg-emerald-500/16 text-[var(--eos-text)]"
                      : "mr-auto border border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-text)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="eos-portal-label">{message.fromMe ? "Ty" : agentName}</p>
                    <time className="shrink-0 text-[9px] text-[var(--eos-muted)]">
                      {messageTime(message.createdAt)}
                    </time>
                  </div>
                  {visibleContent ? <p className="mt-1 whitespace-pre-wrap leading-relaxed">{visibleContent}</p> : null}
                  {message.checkbackQuickReplies?.options?.length ? (
                    <div className="mt-3 flex flex-col gap-2">
                      {message.checkbackQuickReplies.options.map((option) => (
                        <button
                          key={`${message.id}-${option.id}`}
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void respondCheckback(message.checkbackQuickReplies!.activityId, option.id)
                          }
                          className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-left text-xs font-semibold text-[var(--eos-text)] transition hover:border-emerald-400 disabled:opacity-50"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {(message.attachments || []).map((attachment) => (
                    <ContactAttachmentBubble key={attachment.url} attachment={attachment} isMe={message.fromMe} />
                  ))}
                  {copiedId === message.id ? (
                    <p className="mt-1 text-[10px] font-bold text-emerald-700">Skopiowano</p>
                  ) : null}
                  </div>
                );
              })
            )}
            {peerTyping ? (
              <div className="mr-auto inline-flex items-center gap-1 rounded-full border border-[var(--eos-border)] bg-[var(--eos-card)] px-3 py-2">
                <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.2s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-emerald-500" />
                <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:0.2s]" />
              </div>
            ) : null}
          </div>

          {pendingFile ? (
            <div className="eos-inset-well mx-3 mb-2 flex items-center gap-3 rounded-2xl px-4 py-2.5 sm:mx-5">
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

          {error ? <p className="px-4 pb-2 text-xs font-semibold text-red-500 sm:px-5">{error}</p> : null}

          <div className="flex gap-2 border-t border-[var(--eos-border)]/70 p-3 sm:p-4">
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
                  void sendChat();
                }
              }}
              placeholder="Napisz wiadomość do agenta…"
              className="eos-field-inset min-w-0 flex-1 rounded-xl px-4 py-3 text-sm text-[var(--eos-text)]"
            />
            <SendPlaneButton
              sending={busy}
              block={false}
              disabled={busy || (!draft.trim() && !pendingFile)}
              onClick={() => void sendChat()}
              className="shrink-0 px-4"
            >
              <span className="hidden sm:inline">Wyślij</span>
              <Send className="size-4 sm:hidden" />
            </SendPlaneButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
