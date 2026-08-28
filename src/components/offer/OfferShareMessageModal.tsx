'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';
import { fetchCurrentWebUser } from '@/lib/webSessionClient';
import {
  dispatchContactUnreadRefresh,
  initContactThreadWeb,
  sendContactMessageWeb,
} from '@/lib/contactServiceWeb';
import { saveOfferShareIntent } from '@/lib/offerShareIntent';
import OfferShareAuthPrompt from '@/components/offer/OfferShareAuthPrompt';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  peerUserId: number;
  peerName?: string;
  offerId?: number;
  returnPath: string;
};

export default function OfferShareMessageModal({
  isOpen,
  onClose,
  peerUserId,
  peerName,
  offerId,
  returnPath,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) {
      setDraft('');
      setSent(false);
      setError('');
      setAuthPromptOpen(false);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setError('');
    setBusy(true);
    try {
      const user = await fetchCurrentWebUser();
      if (!user) {
        saveOfferShareIntent({
          kind: 'message',
          peerUserId,
          peerName,
          draft: text,
          returnPath,
          offerId,
        });
        setAuthPromptOpen(true);
        return;
      }

      const thread = await initContactThreadWeb(peerUserId);
      await sendContactMessageWeb(thread.id, text);
      dispatchContactUnreadRefresh();
      setSent(true);
      const name = encodeURIComponent(peerName || thread.peerUserName || '');
      window.setTimeout(() => {
        onClose();
        setSent(false);
        window.location.href = `/moje-konto/wiadomosci?thread=${thread.id}&peer=${peerUserId}${name ? `&name=${name}` : ''}`;
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wysłać wiadomości.');
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;

  const modal = (
    <>
      <AnimatePresence>
        {isOpen && !authPromptOpen ? (
          <div className="fixed inset-0 eos-z-modal flex items-end justify-center p-4 sm:items-center">
            <motion.button
              type="button"
              aria-label="Zamknij"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="eos-modal-backdrop absolute inset-0"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              className="eos-modal-surface relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-[var(--eos-border)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--eos-border)] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-[var(--eos-text)]">Napisz wiadomość</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--eos-muted)]">
                      Do {peerName || 'wystawcy'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-9 items-center justify-center rounded-full bg-[var(--eos-input)] text-[var(--eos-muted)]"
                >
                  <X size={18} />
                </button>
              </div>

              {sent ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                    <Send size={28} />
                  </div>
                  <h4 className="text-2xl font-black text-[var(--eos-text)]">Wysłano!</h4>
                  <p className="mt-2 text-sm text-[var(--eos-muted)]">Przekierowujemy do rozmowy…</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                      Twoja wiadomość
                    </label>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={2000}
                      rows={6}
                      placeholder="Dzień dobry, interesuje mnie ta nieruchomość. Czy mogę zadać kilka pytań?"
                      className="w-full resize-none rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 text-sm text-[var(--eos-text)] outline-none focus:border-emerald-500/50"
                    />
                    <p className="mt-2 text-right text-[10px] font-bold text-[var(--eos-subtle)]">
                      {draft.length}/2000
                    </p>
                    {error ? (
                      <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
                        {error}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 border-t border-[var(--eos-border)] p-6">
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={busy || !draft.trim()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-black transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
                      Wyślij wiadomość
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <OfferShareAuthPrompt
        isOpen={authPromptOpen}
        onClose={() => {
          setAuthPromptOpen(false);
          onClose();
        }}
        kind="message"
        returnPath={returnPath}
        publisherName={peerName}
        messagePreview={draft.trim()}
      />
    </>
  );

  return createPortal(modal, document.body);
}
