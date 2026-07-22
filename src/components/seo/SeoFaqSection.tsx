import type { SeoFaqItem } from '@/lib/seo/freeListingContent';
import { faqToJsonLd } from '@/lib/seo/freeListingContent';
import JsonLd from '@/components/seo/JsonLd';

type SeoFaqSectionProps = {
  title?: string;
  intro?: string;
  items: SeoFaqItem[];
  accentClassName?: string;
};

export default function SeoFaqSection({
  title = 'Najczęstsze pytania',
  intro,
  items,
  accentClassName = 'text-emerald-500',
}: SeoFaqSectionProps) {
  return (
    <section className="mt-10 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-6 sm:p-8">
      <JsonLd data={faqToJsonLd(items)} />
      <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${accentClassName}`}>FAQ</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
      {intro ? <p className="mt-2 max-w-2xl text-sm text-[var(--eos-muted)]">{intro}</p> : null}
      <dl className="mt-6 space-y-4">
        {items.map((item) => (
          <div
            key={item.question}
            className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-surface)]/40 px-4 py-4 sm:px-5"
          >
            <dt className="text-base font-semibold tracking-tight text-[var(--eos-text)]">{item.question}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-[var(--eos-muted)]">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
