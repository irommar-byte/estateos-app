/**
 * Strumień postępu NDJSON dla długich operacji (import z linku: opis AI, kopiowanie zdjęć).
 *
 * Klient wysyła nagłówek `x-eos-progress: ndjson` — dostaje kolejne linie
 * {"type":"progress",...} i na końcu {"type":"result","status":200,"body":{...}}.
 * Bez nagłówka trasa odpowiada jak dotąd jednym JSON-em (zgodność ze starszymi wersjami aplikacji).
 */

export type ProgressEvent = {
  type: 'progress';
  stage: 'prepare' | 'copy' | 'images' | 'publish';
  label: string;
  detail?: string;
  /** 0–100, liczone uczciwie z etapów i liczby zdjęć. */
  percent: number;
};

export type ProgressEmit = (event: Omit<ProgressEvent, 'type'>) => void;

export function wantsProgressStream(req: Request): boolean {
  return (req.headers.get('x-eos-progress') || '').toLowerCase() === 'ndjson';
}

export function progressStreamResponse(
  run: (emit: ProgressEmit) => Promise<{ status: number; body: unknown }>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (payload: unknown) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        } catch {
          /* klient się rozłączył — operacja i tak dokończy się na serwerze */
        }
      };
      // Pierwsza linia od razu: proxy (nginx) nie trzyma odpowiedzi, a klient wie, że ruszyło.
      write({ type: 'progress', stage: 'prepare', label: 'Przygotowuję ofertę', percent: 3 });
      const heartbeat = setInterval(() => write({ type: 'ping' }), 10_000);
      try {
        const result = await run((event) => write({ type: 'progress', ...event }));
        write({ type: 'result', ...result });
      } catch (error) {
        write({
          type: 'result',
          status: 500,
          body: { ok: false, error: error instanceof Error ? error.message : 'Nieznany błąd.' },
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

/** Mapuje zdarzenia tworzenia oferty z importu na procent: opis 10–45%, zdjęcia 45–95%. */
export function importCreateProgressHandlers(emit: ProgressEmit) {
  return {
    onCopyProgress: (label: string, detail?: string) =>
      emit({ stage: 'copy', label, detail, percent: /przepisany|skopiowany|uzupełniony/i.test(label) ? 45 : 12 }),
    onImageProgress: (progress: { index: number; total: number; label: string }) =>
      emit({
        stage: 'images',
        label: progress.label,
        percent: 45 + Math.round((Math.min(progress.index, progress.total) / Math.max(1, progress.total)) * 50),
      }),
  };
}
