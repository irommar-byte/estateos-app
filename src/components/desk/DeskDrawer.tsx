'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

export function DeskDrawer({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(0,0,0,0.48)',
        display: 'grid',
        justifyContent: 'end',
      }}
      onClick={onClose}
    >
      <div
        className="eos-desk-root"
        style={{
          width: wide ? 'min(56rem, 100vw)' : 'min(42rem, 100vw)',
          height: '100%',
          background: 'var(--desk-paper)',
          borderLeft: '1px solid var(--desk-line)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.9rem 1.1rem',
            borderBottom: '1px solid var(--desk-line)',
          }}
        >
          <div>
            <p className="eos-desk-kicker" style={{ margin: 0 }}>
              Desk drawer
            </p>
            <h2 className="eos-desk-h1" style={{ fontSize: '1.2rem', margin: 0 }}>
              {title}
            </h2>
          </div>
          <button type="button" className="eos-desk-btn" onClick={onClose}>
            Zamknij
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>{children}</div>
      </div>
    </div>
  );
}

export function DeskIframeDrawer({
  open,
  title,
  src,
  onClose,
}: {
  open: boolean;
  title: string;
  src: string | null;
  onClose: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open) setLoaded(false);
  }, [open, src]);

  return (
    <DeskDrawer open={open} title={title} onClose={onClose} wide>
      {!src ? (
        <p className="eos-desk-muted">Brak adresu formularza.</p>
      ) : (
        <>
          {!loaded ? <p className="eos-desk-muted">Ładuję edytor…</p> : null}
          <iframe
            title={title}
            src={src}
            onLoad={() => setLoaded(true)}
            style={{
              width: '100%',
              height: 'calc(100vh - 5.5rem)',
              border: '1px solid var(--desk-line)',
              borderRadius: '0.75rem',
              background: '#fff',
            }}
          />
        </>
      )}
    </DeskDrawer>
  );
}

export function useDeskDrawer() {
  const [state, setState] = useState<{ open: boolean; title: string; src: string | null }>({
    open: false,
    title: '',
    src: null,
  });

  const openDrawer = useCallback((title: string, src: string) => {
    setState({ open: true, title, src });
  }, []);

  const closeDrawer = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  return { ...state, openDrawer, closeDrawer };
}
