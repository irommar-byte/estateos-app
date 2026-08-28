"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Search, Key, Loader2, X, Smartphone } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

const propertyTypes = ["Apartment", "Penthouse", "Detached house", "Townhouse", "Villa"];
const districtsList = [
  "Śródmieście", "Mokotów", "Żoliborz", "Wola", "Ochota", "Wilanów", "Praga-Południe", "Praga-Północ",
  "Ursynów", "Bielany", "Bemowo", "Białołęka", "Targówek", "Rembertów", "Wesoła", "Wawer", "Ursus", "Włochy",
];

export default function WelcomeGate() {
  const { dict } = useLocale();
  const wg = dict.welcomeGate;
  const [showGate, setShowGate] = useState(false);
  const [mode, setMode] = useState<"choice" | "form">("choice");
  const [loading, setLoading] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyType, setPropertyType] = useState<string[]>([]);
  const [district, setDistrict] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState("");

  const formatNumber = (val: string) => val.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  const toggleSelection = (setter: React.Dispatch<React.SetStateAction<string[]>>, current: string[], item: string) => {
    if (current.includes(item)) setter(current.filter((i) => i !== item));
    else setter([...current, item]);
  };

  useEffect(() => {
    if (!localStorage.getItem("luxestate_path_chosen")) setShowGate(true);
    else setCanClose(true);

    const handleOpenGate = () => {
      setMode("form");
      setShowGate(true);
      setCanClose(true);
    };
    window.addEventListener("open-welcome-gate", handleOpenGate);
    return () => window.removeEventListener("open-welcome-gate", handleOpenGate);
  }, []);

  const handleSellerPath = () => {
    localStorage.setItem("luxestate_path_chosen", "seller");
    setShowGate(false);
    router.push("/dodaj-oferte");
  };

  const handleSeekerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, propertyType, district, maxPrice }),
      });
      localStorage.setItem("luxestate_user", email);
      localStorage.setItem("luxestate_path_chosen", "seeker");
      setShowGate(false);
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!showGate) return null;

  return (
    <div className="fixed inset-0 eos-z-modal overflow-y-auto bg-[var(--eos-bg)]/95 backdrop-blur-3xl">
      <div className="relative flex min-h-screen flex-col items-center justify-center p-4 py-12 md:p-6">
        {canClose && (
          <button
            type="button"
            onClick={() => setShowGate(false)}
            aria-label={wg.close}
            className="absolute right-6 top-6 z-50 rounded-full border border-[var(--eos-border)] bg-[var(--eos-surface)] p-2 text-[var(--eos-muted)] transition-colors hover:text-[var(--eos-text)]"
          >
            <X size={28} />
          </button>
        )}

        <AnimatePresence mode="wait">
          {mode === "choice" && (
            <motion.div
              key="choice"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="my-auto grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2"
            >
              <button
                type="button"
                onClick={() => setMode("form")}
                className="eos-surface-card flex min-h-[40vh] cursor-pointer flex-col items-center justify-center gap-6 rounded-[3rem] border border-[var(--eos-border)] p-12 text-center transition-all hover:border-[var(--eos-accent)]/30 md:min-h-[50vh]"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--eos-input)] transition-transform group-hover:scale-110">
                  <Search size={32} className="text-[var(--eos-text)]" />
                </div>
                <div>
                  <h2 className="mb-4 text-4xl font-bold tracking-tighter text-[var(--eos-text)]">
                    {wg.seekerTitle} <br />
                    <span className="italic text-[var(--eos-muted)]">{wg.seekerTitleMuted}</span>
                  </h2>
                  <p className="text-[var(--eos-muted)]">{wg.seekerSubtitle}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={handleSellerPath}
                className="flex min-h-[40vh] cursor-pointer flex-col items-center justify-center gap-6 rounded-[3rem] border border-[var(--eos-border)] bg-[var(--eos-accent)] p-12 text-center transition-all hover:brightness-105 md:min-h-[50vh]"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--eos-contrast)]/10">
                  <Key size={32} className="text-[var(--eos-contrast)]" />
                </div>
                <div>
                  <h2 className="mb-4 text-4xl font-bold tracking-tighter text-[var(--eos-contrast)]">
                    {wg.sellerTitle} <br />
                    <span className="italic opacity-60">{wg.sellerTitleMuted}</span>
                  </h2>
                  <p className="text-[var(--eos-contrast)]/70">{wg.sellerSubtitle}</p>
                </div>
              </button>
            </motion.div>
          )}

          {mode === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="eos-themed-modal eos-surface-card my-auto w-full max-w-3xl rounded-[2.5rem] border border-[var(--eos-border)] p-8 shadow-[var(--eos-shadow-strong)] md:p-10"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-2 text-4xl font-bold tracking-tighter text-[var(--eos-text)] md:text-5xl">
                {wg.formTitle} <span className="italic text-[var(--eos-muted)]">{wg.formTitleMuted}</span>
              </h2>
              <p className="mb-8 text-sm text-[var(--eos-muted)] md:text-base">{wg.formSubtitle}</p>

              <form onSubmit={handleSeekerSubmit} className="space-y-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 focus-within:border-[var(--eos-accent)]/40">
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                      {wg.emailLabel}
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="john@example.com"
                      className="w-full appearance-none bg-transparent text-xl text-[var(--eos-text)] outline-none md:text-2xl"
                      onChange={(e) => setEmail(e.target.value)}
                      value={email}
                    />
                  </div>
                  <div className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 focus-within:border-[var(--eos-accent)]/40">
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                      {wg.budgetLabel}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="3 000 000"
                      className="w-full appearance-none bg-transparent text-xl text-[var(--eos-text)] outline-none md:text-2xl"
                      onChange={(e) => setMaxPrice(formatNumber(e.target.value))}
                      value={maxPrice}
                    />
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] p-4 focus-within:border-[var(--eos-accent)]/40">
                  <div className="absolute right-0 top-0 p-4 opacity-10">
                    <Smartphone size={60} />
                  </div>
                  <label className="relative z-10 mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                    {wg.phoneLabel}
                  </label>
                  <input
                    type="tel"
                    placeholder="+48 ..."
                    className="relative z-10 w-full appearance-none bg-transparent text-xl text-[var(--eos-text)] outline-none"
                    onChange={(e) => setPhone(e.target.value)}
                    value={phone}
                  />
                  <p className="relative z-10 mt-2 flex items-center gap-1 text-xs font-medium text-[var(--eos-accent)]">
                    {wg.phoneHint}
                  </p>
                </div>

                <div>
                  <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                    {wg.propertyTypesLabel}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {propertyTypes.map((pt) => (
                      <button
                        type="button"
                        key={pt}
                        onClick={() => toggleSelection(setPropertyType, propertyType, pt)}
                        className={`cursor-pointer rounded-full border px-5 py-2.5 text-sm font-bold transition-all ${
                          propertyType.includes(pt)
                            ? "border-[var(--eos-accent)] bg-[var(--eos-accent)] text-[var(--eos-contrast)]"
                            : "border-[var(--eos-border)] bg-transparent text-[var(--eos-muted)] hover:border-[var(--eos-border-strong)]"
                        }`}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-muted)]">
                    {wg.districtsLabel}
                  </label>
                  <div className="custom-scrollbar flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-2">
                    {districtsList.map((dist) => (
                      <button
                        type="button"
                        key={dist}
                        onClick={() => toggleSelection(setDistrict, district, dist)}
                        className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-bold transition-all ${
                          district.includes(dist)
                            ? "border-[var(--eos-accent)] bg-[var(--eos-accent)] text-[var(--eos-contrast)]"
                            : "border-[var(--eos-border)] bg-[var(--eos-input)] text-[var(--eos-muted)] hover:border-[var(--eos-border-strong)]"
                        }`}
                      >
                        {dist}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-4 border-t border-[var(--eos-border)] pt-4 md:flex-row">
                  <button
                    type="button"
                    onClick={() => setMode("choice")}
                    className="w-full cursor-pointer rounded-full border border-[var(--eos-border)] px-8 py-5 font-bold text-[var(--eos-muted)] transition-colors hover:bg-[var(--eos-input)] hover:text-[var(--eos-text)] md:w-auto"
                  >
                    {wg.back}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--eos-accent)] py-5 text-xl font-bold text-[var(--eos-contrast)] shadow-[0_0_30px_rgba(16,185,129,0.25)] transition-colors hover:brightness-105 disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : wg.submit}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
