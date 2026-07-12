"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import ContactAttachmentBubble from "@/components/contact/ContactAttachmentBubble";
import {
  formatContactBytes,
  isAllowedContactAttachment,
  MAX_CONTACT_FILE_BYTES,
  MAX_CONTACT_THREAD_BYTES,
  parseContactMessageParts,
  formatContactLastMessagePreview,
  CONTACT_ATTACHMENT_PREFIX,
} from "@/lib/contactAttachmentShared";
import {
  ContactMessageRow,
  ContactThreadAttachmentsInfo,
  ContactThreadRow,
  dispatchContactUnreadRefresh,
  fetchContactAttachmentsWeb,
  fetchContactMessagesWeb,
  fetchContactThreadsWeb,
  initContactThreadWeb,
  sendContactMessageWeb,
  sendContactTypingWeb,
  uploadContactAttachmentWeb,
} from "@/lib/contactServiceWeb";

type CurrentUser = { id: number; name?: string | null };

const ACCEPTED_FILE_TYPES =
  "image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.gif,.mp3,.mp4,.mov,.webm";

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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [findUserId, setFindUserId] = useState("");
  const [findError, setFindError] = useState<string | null>(null);
  const [findLoading, setFindLoading] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [attachmentsInfo, setAttachmentsInfo] = useState<ContactThreadAttachmentsInfo | null>(null);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<number | null>(null);
  const typingRef = useRef<number | null>(null);
  const isUserScrolling = useRef(false);
  const prevMsgCount = useRef(0);
  const initializedScroll = useRef(false);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const showMobileChat = activeThreadId != null;

  const handlePageBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/moje-konto");
  }, [router]);

  const handleMobileChatBack = useCallback(() => {
    const from = searchParams.get("from");
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    if (from) {
      router.push(from);
      return;
    }
    router.replace("/moje-konto/wiadomosci");
  }, [router, searchParams]);

  const usageBytes = attachmentsInfo?.usageBytes ?? 0;
  const limitBytes = attachmentsInfo?.limitBytes ?? MAX_CONTACT_THREAD_BYTES;
  const usagePct = Math.min(100, (usageBytes / limitBytes) * 100);

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isUserScrolling.current = false;
    setShowScrollBottom(false);
  }, []);

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolling.current = distance > 100;
    setShowScrollBottom(distance > 100);
  }, []);

  const loadAttachmentsInfo = useCallback(async (threadId: number) => {
    setLoadingAttachments(true);
    try {
      const info = await fetchContactAttachmentsWeb(threadId);
      setAttachmentsInfo(info);
    } catch {
      setAttachmentsInfo(null);
    } finally {
      setLoadingAttachments(false);
    }
  }, []);

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
      setAttachmentsOpen(false);
      initializedScroll.current = false;
      prevMsgCount.current = 0;
      try {
        const data = await fetchContactMessagesWeb(threadId);
        setMessages(data.messages);
        setIsTyping(Boolean(data.isTyping));
        dispatchContactUnreadRefresh();
        await Promise.all([loadThreads(), loadAttachmentsInfo(threadId)]);
      } catch {
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [loadAttachmentsInfo, loadThreads]
  );

  const navigateToThread = useCallback(
    (threadId: number, peerUserId: number, opts?: { replace?: boolean }) => {
      const url = `/moje-konto/wiadomosci?thread=${threadId}&peer=${peerUserId}`;
      if (opts?.replace) router.replace(url);
      else router.push(url);
      void openThread(threadId);
    },
    [openThread, router]
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

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
        return;
      }
      setActiveThreadId(null);
      setMessages([]);
      setAttachmentsInfo(null);
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
      void loadAttachmentsInfo(activeThreadId);
    }, 3500);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
  }, [activeThreadId, loadAttachmentsInfo]);

  useEffect(() => {
    const currentCount = messages.length;
    if (!initializedScroll.current && currentCount > 0 && !loadingMessages) {
      window.setTimeout(() => scrollChatToBottom("auto"), 80);
      initializedScroll.current = true;
      prevMsgCount.current = currentCount;
      return;
    }
    if (currentCount > prevMsgCount.current && !isUserScrolling.current) {
      window.setTimeout(() => scrollChatToBottom("smooth"), 80);
    }
    prevMsgCount.current = currentCount;
  }, [messages, isTyping, loadingMessages, scrollChatToBottom]);

  const handleJumpToBottom = () => {
    scrollChatToBottom("smooth");
    window.setTimeout(() => draftInputRef.current?.focus(), 120);
  };

  const handlePickFile = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_CONTACT_FILE_BYTES) {
      window.alert(`Plik jest za duży. Maksymalnie ${formatContactBytes(MAX_CONTACT_FILE_BYTES)} na załącznik.`);
      return;
    }
    if (!isAllowedContactAttachment(file.type, file.name)) {
      window.alert("Niedozwolony typ pliku.");
      return;
    }
    if (usageBytes + file.size > limitBytes) {
      window.alert("Przekroczono łączny limit 100 MB załączników w tej rozmowie.");
      return;
    }
    setPendingFile(file);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadId || sending || uploading) return;
    const content = draft.trim();
    const fileSnapshot = pendingFile;
    if (!content && !fileSnapshot) return;

    setSending(true);
    setDraft("");
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    const optimistic: ContactMessageRow = {
      id: -Date.now(),
      threadId: activeThreadId,
      senderId: currentUser.id,
      content: content || (fileSnapshot ? `📎 ${fileSnapshot.name}` : ""),
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setMessages((prev) => [...prev, optimistic]);
    isUserScrolling.current = false;
    scrollChatToBottom("smooth");

    try {
      let attachmentMeta = null;
      if (fileSnapshot) {
        setUploading(true);
        attachmentMeta = await uploadContactAttachmentWeb(activeThreadId, fileSnapshot);
        setUploading(false);
      }
      const saved = await sendContactMessageWeb(activeThreadId, content, attachmentMeta);
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
      await Promise.all([loadThreads(), loadAttachmentsInfo(activeThreadId)]);
    } catch (err: unknown) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(content);
      if (fileSnapshot) setPendingFile(fileSnapshot);
      window.alert(err instanceof Error ? err.message : "Nie udało się wysłać wiadomości.");
    } finally {
      setSending(false);
      setUploading(false);
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
      navigateToThread(thread.id, peerId);
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
      setAttachmentsInfo(null);
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
    <div className="theme-aware-dashboard mx-auto flex h-[calc(100dvh-6rem)] max-h-[calc(100dvh-6rem)] max-w-6xl flex-col gap-3 overflow-hidden px-4 py-4 md:py-6">
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={handlePageBack}
          className="rounded-full border border-[var(--eos-border)] p-2 text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
          aria-label="Wróć"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">EstateOS™ Contact</p>
          <h1 className="text-xl font-black tracking-tight text-[var(--eos-text)] md:text-2xl">Wiadomości bezpośrednie</h1>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[var(--eos-shadow-strong)] md:grid-cols-[minmax(0,320px)_1fr]">
        <aside
          className={`min-h-0 flex-col border-b border-[var(--eos-border)] md:border-b-0 md:border-r ${
            showMobileChat ? "hidden md:flex" : "flex"
          }`}
        >
          <form onSubmit={handleFindUser} className="shrink-0 border-b border-[var(--eos-border)] p-3">
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
                      navigateToThread(thread.id, thread.peerUserId);
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
                      <p className="truncate text-xs text-[var(--eos-muted)]">
                        {(() => {
                          const raw = String(thread.lastMessage || "");
                          if (!raw) return "Brak wiadomości";
                          if (raw.includes(CONTACT_ATTACHMENT_PREFIX)) {
                            return formatContactLastMessagePreview({ content: raw }) || "Brak wiadomości";
                          }
                          return raw;
                        })()}
                      </p>
                      <p className="text-[10px] text-[var(--eos-subtle)]">ID {thread.peerUserId}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <motion.section
          key={activeThreadId ?? "inbox-empty"}
          initial={{ x: "100%", opacity: 0.98 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
          className={`eos-contact-panel relative flex min-h-0 min-w-0 flex-col md:!transform-none md:!opacity-100 ${
            showMobileChat
              ? "fixed inset-0 z-30 flex bg-[var(--eos-card)] md:relative md:inset-auto md:z-auto"
              : "hidden md:flex"
          }`}
        >
          {!activeThread ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-white/50">
              <MessageCircle className="size-10 text-emerald-500/50" />
              <p className="text-sm">Wybierz rozmowę z listy lub znajdź użytkownika po ID.</p>
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-white/10 px-4 py-3 md:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <button
                      type="button"
                      onClick={handleMobileChatBack}
                      className="mt-0.5 shrink-0 rounded-full p-1.5 text-white/70 hover:bg-white/10 md:hidden"
                      aria-label="Wróć do listy rozmów"
                    >
                      <ArrowLeft className="size-5" />
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">{activeThread.peerUserName}</p>
                      <p className="text-[10px] uppercase tracking-widest text-white/40">ID {activeThread.peerUserId}</p>
                    </div>
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

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="min-w-[180px] flex-1">
                    <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-white/45">
                      <span>Załączniki rozmowy</span>
                      <span>
                        {formatContactBytes(usageBytes)} / {formatContactBytes(limitBytes)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usagePct > 90 ? "bg-red-500" : usagePct > 70 ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                        style={{ width: `${usagePct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[9px] text-white/30">
                      Max {formatContactBytes(MAX_CONTACT_FILE_BYTES)} na plik · pozostało{" "}
                      {formatContactBytes(Math.max(0, limitBytes - usageBytes))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachmentsOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/80 transition hover:bg-white/10"
                  >
                    <Paperclip className="size-3.5" />
                    Pokaż załączniki
                    {attachmentsOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {attachmentsOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="eos-contact-panel shrink-0 overflow-hidden border-b border-[var(--eos-border)]"
                  >
                    <div className="max-h-44 overflow-y-auto px-4 py-3 custom-scrollbar md:px-5">
                      {loadingAttachments ? (
                        <div className="flex items-center gap-2 text-xs text-white/40">
                          <Loader2 className="size-4 animate-spin" /> Ładowanie…
                        </div>
                      ) : !attachmentsInfo?.attachments?.length ? (
                        <p className="text-xs text-white/35">Brak załączników w tej rozmowie.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {attachmentsInfo.attachments.map((att) => (
                            <a
                              key={`${att.messageId}-${att.url}`}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 transition hover:bg-white/10"
                            >
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                                <FileText className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-white">{att.name}</p>
                                <p className="text-[10px] text-white/40">
                                  {formatContactBytes(att.size)} ·{" "}
                                  {new Date(att.createdAt).toLocaleDateString("pl-PL")}
                                </p>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 custom-scrollbar"
              >
                {loadingMessages ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-6 animate-spin text-emerald-500" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence initial={false}>
                      {messages.map((msg, i) => {
                        const isMe = msg.senderId === currentUser.id;
                        const { text, attachment } = parseContactMessageParts(msg);
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
                                {text ? (
                                  <p className={`text-[15px] leading-relaxed ${isMe ? "font-semibold" : "font-normal"}`}>
                                    {text}
                                  </p>
                                ) : null}
                                {attachment ? <ContactAttachmentBubble attachment={attachment} isMe={isMe} /> : null}
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
                  </div>
                )}

                <AnimatePresence>
                  {showScrollBottom ? (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      onClick={handleJumpToBottom}
                      className="sticky bottom-4 left-1/2 z-10 mx-auto flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[#111]/95 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:bg-[#1a1a1a]"
                    >
                      <ArrowDown className="size-3.5 text-emerald-400" />
                      Na dół
                    </motion.button>
                  ) : null}
                </AnimatePresence>
              </div>

              <form
                onSubmit={handleSend}
                className="shrink-0 border-t border-white/10 bg-gradient-to-t from-[#080808] to-transparent p-4 md:p-5"
              >
                {pendingFile ? (
                  <div className="mx-auto mb-3 flex max-w-3xl items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5">
                    <Paperclip className="size-4 shrink-0 text-emerald-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">{pendingFile.name}</p>
                      <p className="text-[10px] text-white/45">{formatContactBytes(pendingFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                      aria-label="Usuń załącznik"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : null}

                <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-[2rem] border border-white/10 bg-[#111] p-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] focus-within:border-emerald-500/40">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    className="hidden"
                    onChange={(e) => {
                      handlePickFile(e.target.files?.[0] ?? null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploading}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-emerald-400 disabled:opacity-40"
                    aria-label="Dodaj załącznik"
                  >
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                  </button>
                  <input
                    ref={draftInputRef}
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    placeholder="Napisz wiadomość…"
                    className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-white/30"
                  />
                  <button
                    type="submit"
                    disabled={(!draft.trim() && !pendingFile) || sending || uploading}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-black transition hover:bg-emerald-400 disabled:opacity-40"
                    aria-label="Wyślij"
                  >
                    {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
                  </button>
                </div>
              </form>
            </>
          )}
        </motion.section>
      </div>
    </div>
  );
}
