"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import {
  ContactMessageRow,
  ContactThreadRow,
  dispatchContactUnreadRefresh,
  fetchContactMessagesWeb,
  fetchContactThreadsWeb,
  initContactThreadWeb,
  sendContactMessageWeb,
  sendContactTypingWeb,
} from "@/lib/contactServiceWeb";

type CurrentUser = { id: number; name?: string | null };

export default function ContactInboxClient({ currentUser }: { currentUser: CurrentUser }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<ContactThreadRow[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [findUserId, setFindUserId] = useState("");
  const [findError, setFindError] = useState<string | null>(null);
  const [findLoading, setFindLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const typingRef = useRef<number | null>(null);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const loadThreads = useCallback(async () => {
    try {
      const { threads: rows } = await fetchContactThreadsWeb();
      setThreads(rows);
      dispatchContactUnreadRefresh();
      return rows;
    } catch {
      setThreads([]);
      return [];
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const openThread = useCallback(
    async (threadId: number) => {
      setActiveThreadId(threadId);
      setLoadingMessages(true);
      try {
        const data = await fetchContactMessagesWeb(threadId);
        setMessages(data.messages);
        setIsTyping(Boolean(data.isTyping));
        dispatchContactUnreadRefresh();
        await loadThreads();
      } catch {
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [loadThreads]
  );

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    const threadParam = Number(searchParams.get("thread"));
    const peerParam = Number(searchParams.get("peer"));

    void (async () => {
      const rows = await loadThreads();
      if (Number.isFinite(threadParam) && threadParam > 0) {
        setActiveThreadId(threadParam);
        await openThread(threadParam);
        return;
      }
      if (Number.isFinite(peerParam) && peerParam > 0) {
        const existing = rows.find((t) => t.peerUserId === peerParam);
        if (existing) {
          await openThread(existing.id);
          return;
        }
        try {
          const created = await initContactThreadWeb(peerParam);
          await loadThreads();
          await openThread(created.id);
        } catch {
          /* handled on write button path */
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!activeThreadId) return;
    pollRef.current = window.setInterval(() => {
      void fetchContactMessagesWeb(activeThreadId)
        .then((data) => {
          setMessages(data.messages);
          setIsTyping(Boolean(data.isTyping));
        })
        .catch(() => undefined);
    }, 3500);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
  }, [activeThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadId || !draft.trim() || sending) return;
    const content = draft.trim();
    setDraft("");
    setSending(true);
    const optimistic: ContactMessageRow = {
      id: -Date.now(),
      threadId: activeThreadId,
      senderId: currentUser.id,
      content,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const saved = await sendContactMessageWeb(activeThreadId, content);
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
      await loadThreads();
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
      window.alert(err instanceof Error ? err.message : "Nie udało się wysłać wiadomości.");
    } finally {
      setSending(false);
    }
  };

  const handleFindUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFindError(null);
    const peerId = Number(findUserId.trim());
    if (!Number.isFinite(peerId) || peerId <= 0) {
      setFindError("Podaj prawidłowe ID użytkownika.");
      return;
    }
    if (peerId === currentUser.id) {
      setFindError("Nie możesz napisać do siebie.");
      return;
    }
    setFindLoading(true);
    try {
      const thread = await initContactThreadWeb(peerId);
      await loadThreads();
      router.replace(`/moje-konto/wiadomosci?thread=${thread.id}&peer=${peerId}`);
      await openThread(thread.id);
      setFindUserId("");
    } catch (err: unknown) {
      setFindError(err instanceof Error ? err.message : "Nie udało się znaleźć użytkownika.");
    } finally {
      setFindLoading(false);
    }
  };

  const handleDeleteThread = async () => {
    if (!activeThreadId) return;
    if (!window.confirm("Usunąć tę rozmowę z listy?")) return;
    try {
      const res = await fetch(`/api/contact/threads/${activeThreadId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error || "Nie udało się usunąć wątku."));
      setActiveThreadId(null);
      setMessages([]);
      router.replace("/moje-konto/wiadomosci");
      await loadThreads();
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : "Błąd usuwania.");
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!activeThreadId) return;
    if (typingRef.current != null) window.clearTimeout(typingRef.current);
    typingRef.current = window.setTimeout(() => {
      void sendContactTypingWeb(activeThreadId);
    }, 350);
  };

  return (
    <div className="theme-aware-dashboard mx-auto flex min-h-[calc(100dvh-6rem)] max-w-6xl flex-col gap-4 px-4 py-6 md:py-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/moje-konto/crm")}
          className="rounded-full border border-[var(--eos-border)] p-2 text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
          aria-label="Wróć"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">EstateOS™ Contact</p>
          <h1 className="text-2xl font-black tracking-tight text-[var(--eos-text)]">Wiadomości bezpośrednie</h1>
        </div>
      </div>

      <div className="grid min-h-[560px] flex-1 grid-cols-1 overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-strong)] md:grid-cols-[minmax(0,320px)_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-[var(--eos-border)] md:border-b-0 md:border-r">
          <form onSubmit={handleFindUser} className="border-b border-[var(--eos-border)] p-3">
            <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.18em] text-[var(--eos-muted)]">
              Napisz po ID użytkownika
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--eos-subtle)]" />
                <input
                  value={findUserId}
                  onChange={(e) => setFindUserId(e.target.value.replace(/\D/g, ""))}
                  placeholder="np. 55"
                  className="w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] py-2.5 pl-9 pr-3 text-sm text-[var(--eos-text)] outline-none focus:border-emerald-500/40"
                />
              </div>
              <button
                type="submit"
                disabled={findLoading}
                className="rounded-xl bg-emerald-500 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-60"
              >
                {findLoading ? <Loader2 className="size-4 animate-spin" /> : "Dodaj"}
              </button>
            </div>
            {findError ? <p className="mt-2 text-xs text-red-400">{findError}</p> : null}
          </form>

          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
            {loadingThreads ? (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="size-6 animate-spin text-emerald-500" />
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--eos-muted)]">
                Brak rozmów. Wpisz ID użytkownika powyżej lub kliknij „Napisz” na profilu oferty.
              </div>
            ) : (
              threads.map((thread) => {
                const unread = Number(thread.unread ?? thread.unreadCount ?? 0);
                const selected = thread.id === activeThreadId;
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => {
                      router.replace(`/moje-konto/wiadomosci?thread=${thread.id}&peer=${thread.peerUserId}`);
                      void openThread(thread.id);
                    }}
                    className={`flex w-full items-center gap-3 border-b border-[var(--eos-border)] px-4 py-3 text-left transition-colors ${
                      selected ? "bg-emerald-500/10" : "hover:bg-[var(--eos-input)]"
                    }`}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--eos-border)] bg-[var(--eos-bg)]">
                      {thread.peer?.image ? (
                        <img src={thread.peer.image} alt="" className="size-full object-cover" />
                      ) : (
                        <User className="size-4 text-[var(--eos-subtle)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-[var(--eos-text)]">{thread.peerUserName}</p>
                        {unread > 0 ? (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-[var(--eos-muted)]">{thread.lastMessage || "Brak wiadomości"}</p>
                      <p className="text-[10px] text-[var(--eos-subtle)]">ID {thread.peerUserId}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-[420px] min-w-0 flex-col bg-[#080808] md:min-h-0">
          {!activeThread ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-white/50">
              <MessageCircle className="size-10 text-emerald-500/50" />
              <p className="text-sm">Wybierz rozmowę z listy lub znajdź użytkownika po ID.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{activeThread.peerUserName}</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">ID {activeThread.peerUserId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 sm:flex">
                    <ShieldCheck className="size-3.5" /> Contact
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteThread()}
                    className="rounded-full p-2 text-white/40 hover:bg-red-500/10 hover:text-red-400"
                    aria-label="Usuń rozmowę"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 custom-scrollbar">
                {loadingMessages ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-6 animate-spin text-emerald-500" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence initial={false}>
                      {messages.map((msg, i) => {
                        const isMe = msg.senderId === currentUser.id;
                        return (
                          <motion.div
                            key={msg.id || i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`flex max-w-[85%] items-end gap-3 md:max-w-[70%] ${
                                isMe ? "flex-row-reverse" : "flex-row"
                              }`}
                            >
                              {!isMe ? (
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-b from-[#222] to-[#111]">
                                  <span className="text-[10px] font-black text-white/50">
                                    {activeThread.peerUserName?.charAt(0) || "👤"}
                                  </span>
                                </div>
                              ) : null}
                              <div
                                className={`px-5 py-3.5 shadow-xl ${
                                  isMe
                                    ? "rounded-[1.6rem] rounded-br-md bg-gradient-to-b from-emerald-500 to-emerald-600 text-black"
                                    : "rounded-[1.6rem] rounded-bl-md border border-white/10 bg-white/5 text-white/90 backdrop-blur-md"
                                }`}
                              >
                                <p className={`text-[15px] leading-relaxed ${isMe ? "font-semibold" : "font-normal"}`}>
                                  {msg.content}
                                </p>
                              </div>
                            </div>
                            <div className={`mt-1.5 flex items-center gap-1.5 ${isMe ? "mr-2" : "ml-10"}`}>
                              {isMe ? (
                                msg.isRead ? (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-blue-400">
                                    <CheckCheck className="size-3" /> Odczytano
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[9px] font-bold text-white/40">
                                    <Check className="size-3" /> Dostarczono
                                  </span>
                                )
                              ) : null}
                              <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">
                                {new Date(msg.createdAt).toLocaleTimeString("pl-PL", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                      {isTyping ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5">
                            <span className="text-[10px] font-black text-white/50">
                              {activeThread.peerUserName?.charAt(0) || "👤"}
                            </span>
                          </div>
                          <div className="flex gap-1.5 rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-3">
                            {[0, 0.2, 0.4].map((delay) => (
                              <motion.div
                                key={delay}
                                animate={{ y: [0, -4, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay }}
                                className="size-1.5 rounded-full bg-white/40"
                              />
                            ))}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <form
                onSubmit={handleSend}
                className="shrink-0 border-t border-white/10 bg-gradient-to-t from-[#080808] to-transparent p-4 md:p-5"
              >
                <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-[2rem] border border-white/10 bg-[#111] p-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] focus-within:border-emerald-500/40">
                  <input
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    placeholder="Napisz wiadomość…"
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-black transition hover:bg-emerald-400 disabled:opacity-40"
                    aria-label="Wyślij"
                  >
                    {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
