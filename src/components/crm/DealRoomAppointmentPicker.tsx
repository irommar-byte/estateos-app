"use client";

import React, { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

type Props = {
  onCancel: () => void;
  onSubmit: (isoDate: string, note: string) => void | Promise<void>;
  loading?: boolean;
};

export default function DealRoomAppointmentPicker({ onCancel, onSubmit, loading }: Props) {
  const dates = useMemo(() => {
    const out: Date[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDateIso, setSelectedDateIso] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [note, setNote] = useState('');

  const buildFinalIso = () => {
    const final = new Date(selectedDateIso);
    const [h, m] = selectedTime.split(':');
    final.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
    return final.toISOString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-400/80">
            Krok {step} z 3
          </p>
          <p className="text-white font-black text-lg">
            {step === 1 ? 'Wybierz dzień' : step === 2 ? 'Wybierz godzinę' : 'Potwierdź termin'}
          </p>
        </div>
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((step - 1) as 1 | 2 | 3)}
            className="text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white"
          >
            Wstecz
          </button>
        ) : null}
      </div>

      {step === 1 ? (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {dates.map((d) => {
            const iso = d.toISOString();
            const selected = selectedDateIso === iso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => {
                  setSelectedDateIso(iso);
                  setTimeout(() => setStep(2), 180);
                }}
                className={`relative aspect-square rounded-2xl border flex flex-col items-center justify-center transition-all ${
                  selected
                    ? 'bg-[#0a0a0a] border-2 border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.25)] scale-[1.03]'
                    : 'bg-[#111] border-white/10 hover:border-white/25'
                }`}
              >
                <span className={`text-[9px] font-black uppercase ${selected ? 'text-emerald-400' : 'text-white/40'}`}>
                  {d.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '')}
                </span>
                <span className={`text-xl font-black ${selected ? 'text-emerald-400' : 'text-white'}`}>{d.getDate()}</span>
                <span className={`text-[8px] font-bold uppercase ${selected ? 'text-emerald-400/80' : 'text-white/30'}`}>
                  {d.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '')}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {HOURS.map((h) => {
            const selected = selectedTime === h;
            return (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setSelectedTime(h);
                  setTimeout(() => setStep(3), 180);
                }}
                className={`py-3.5 rounded-xl border text-sm font-black tracking-widest transition-all ${
                  selected
                    ? 'bg-[#0a0a0a] text-emerald-400 border-2 border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.25)]'
                    : 'bg-[#111] border-white/10 text-white/80 hover:border-white/25'
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 mb-1">Twój termin</p>
            <p className="text-emerald-300 font-black text-lg">
              {new Date(buildFinalIso()).toLocaleString('pl-PL', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Opcjonalna wiadomość do drugiej strony…"
            className="w-full min-h-[72px] rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white text-sm outline-none focus:border-emerald-500/40"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void onSubmit(buildFinalIso(), note.trim())}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-emerald-500/40 bg-[#0a0a0a] hover:bg-emerald-950/40 text-emerald-400 font-black uppercase tracking-[0.18em] text-xs disabled:opacity-40"
          >
            <ShieldCheck size={16} />
            Wyślij kontrofertę terminu
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onCancel}
        className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white/70"
      >
        Anuluj
      </button>
    </div>
  );
}
