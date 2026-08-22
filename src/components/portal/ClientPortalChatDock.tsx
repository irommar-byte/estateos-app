"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Paperclip, Plus, Send, X } from "lucide-react";
import ContactAttachmentBubble from "@/components/contact/ContactAttachmentBubble";
import { formatContactBytes, type ContactAttachmentMeta } from "@/lib/contactAttachmentShared";
import SendPlaneButton from "@/components/ui/SendPlaneButton";

type PortalMessage = {
  id: number;
  content: string;
  createdAt: string;
  fromAgent: boolean;
  fromMe: boolean;
  attachments?: ContactAttachmentMeta[];
};

export default function ClientPortalChatDock({
  token,
  agentName,
}: {
  token: string;
  agentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const holdTimer = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);

  const loadMessages = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_messages" }),
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.messages)) {
        setMessages(json.messages);
        setPeerTyping(Boolean(json.peerTyping));
      }
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => void loadMessages(), 2500);
    return () => window.clearInterval(t);
  }, [open, loadMessages]);

  useEffect(() => {
    if (open) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }
  }, [open, messages.length, peerTyping]);

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

  const sendChat = async () => {
    const content = draft.trim();
    if (!token || busy || (!content && !pendingFile)) return;
    setBusy(true);
    try {
      let attachments: ContactAttachmentMeta[] = [];
      if (pendingFile) {
        const payload = new FormData();
        payload.append("file", pendingFile);
        const up = await fetch(`/api/crm/client-portal/${token}/attachments`, { method: "POST", body: payload });
        const upJson = await up.json();
        if (!up.ok) throw new Error(upJson.error || "Nie udało się wgrać załącznika.");
        attachments = [upJson.attachment];
      }
      const res = await fetch(`/api/crm/client-portal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_message", content, attachments }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nie udało się wysłać");
      setDraft("");
      setPendingFile(null);
      await loadMessages();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Błąd");
    } finally {
      setBusy(false);
    }
  };

  const copyMessage = async (msg: PortalMessage) => {
    const text = msg.content || (msg.attachments || []).map((a) => a.name).join(", ");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="eos-inset-well eos-chat-tile flex w-full items-center gap-3 rounded-xl p-3 text-left"
      >
        <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
          <MessageSquare className="size-4" />
          {messages.length ? (
            <span className="absolute -right-1.5 -top-1.5 min-w-[1.1rem] rounded-full bg-emerald-500 px-1 text-center text-[9px] font-black leading-4 text-black">
              {messages.length > 9 ? "9+" : messages.length}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="eos-portal-label">Kontakt z agentem</p>
          <p className="text-xs font-bold text-[var(--eos-text)]">Napisz wiadomość</p>
        </div>
        <span className="eos-send-plane__stack text-emerald-600" aria-hidden>
          <Send className="eos-send-plane__fly size-3.5" />
          <Send className="eos-send-plane__park size-3.5" />
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="eos-lux-panel flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[1.6rem]">
            <div className="flex items-center justify-between border-b border-[var(--eos-border)]/70 px-4 py-3">
              <div>
                <p className="eos-portal-label eos-portal-label--ok">Czat z agentem</p>
                <p className="text-sm font-black text-[var(--eos-text)]">{agentName}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-[var(--eos-muted)]">
                <X className="size-5" />
              </button>
            </div>
            <div ref={listRef} className="min-h-[240px] flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {messages.length === 0 ? (
                <p className="py-10 text-center text-sm text-[var(--eos-muted)]">
                  Napisz pierwszą wiadomość albo wyślij dokument.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      void copyMessage(m);
                    }}
                    onPointerDown={() => {
                      holdTimer.current = window.setTimeout(() => void copyMessage(m), 520);
                    }}
                    onPointerUp={() => {
                      if (holdTimer.current) window.clearTimeout(holdTimer.current);
                    }}
                    onPointerLeave={() => {
                      if (holdTimer.current) window.clearTimeout(holdTimer.current);
                    }}
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      m.fromMe
                        ? "ml-10 bg-emerald-500/15 text-[var(--eos-text)]"
                        : "mr-10 bg-[var(--eos-card)] text-[var(--eos-text)]"
                    }`}
                  >
                    <p className="eos-portal-label">{m.fromMe ? "Ty" : agentName}</p>
                    {m.content ? <p className="mt-1 whitespace-pre-wrap">{m.content}</p> : null}
                    {(m.attachments || []).map((att) => (
                      <ContactAttachmentBubble key={att.url} attachment={att} isMe={m.fromMe} />
                    ))}
                    {copiedId === m.id ? (
                      <p className="mt-1 text-[10px] font-bold text-emerald-700">Skopiowano</p>
                    ) : null}
                  </div>
                ))
              )}
              {peerTyping ? (
                <div className="mr-10 inline-flex items-center gap-1 rounded-full bg-[var(--eos-card)] px-3 py-2">
                  <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.2s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-emerald-500" />
                  <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:0.2s]" />
                </div>
              ) : null}
            </div>
            {pendingFile ? (
              <div className="eos-inset-well mx-3 mb-2 flex items-center gap-3 rounded-2xl px-4 py-2.5">
                <Paperclip className="size-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{pendingFile.name}</p>
                  <p className="text-[10px] text-[var(--eos-muted)]">{formatContactBytes(pendingFile.size)}</p>
                </div>
                <button type="button" onClick={() => setPendingFile(null)} className="rounded-full p-1.5 text-[var(--eos-muted)]">
                  <X className="size-4" />
                </button>
              </div>
            ) : null}
            <div className="flex gap-2 border-t border-[var(--eos-border)]/70 p-3">
              <label className="eos-inset-well flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--eos-muted)] hover:text-emerald-600">
                <Plus className="size-5" />
                <input type="file" className="hidden" onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
              </label>
              <input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  pingTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void sendChat();
                  }
                }}
                placeholder="Napisz wiadomość do agenta…"
                className="eos-field-inset flex-1 rounded-xl px-4 py-3 text-sm text-[var(--eos-text)]"
              />
              <SendPlaneButton
                sending={busy}
                block={false}
                disabled={busy || (!draft.trim() && !pendingFile)}
                onClick={() => void sendChat()}
                className="shrink-0 px-4"
              >
                Wyślij
              </SendPlaneButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
