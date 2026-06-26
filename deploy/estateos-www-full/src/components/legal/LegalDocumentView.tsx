import Link from 'next/link';
import type { LegalDocumentContent } from '@/content/legal/types';
import RichLegalText from '@/components/legal/RichLegalText';

type Props = {
  doc: LegalDocumentContent;
  showLocaleSwitcher?: boolean;
};

export default function LegalDocumentView({ doc, showLocaleSwitcher = true }: Props) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-800">
      {showLocaleSwitcher && doc.localeLinks.length > 0 ? (
        <p className="mb-2 text-sm text-zinc-500">
          {doc.localeLinks.map((link, index) => (
            <span key={link.href}>
              {index > 0 ? ' · ' : null}
              <Link className="text-emerald-700 underline" href={link.href}>
                {link.label}
              </Link>
            </span>
          ))}
        </p>
      ) : null}

      <h1 className="mb-2 text-3xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mb-8 text-sm text-zinc-500">
        {doc.updatedLabel} {doc.updated}
      </p>

      <section className="space-y-6 text-[15px] leading-relaxed">
        <p>
          <RichLegalText text={doc.intro} />
        </p>

        {doc.sections.map((section) => (
          <div key={section.title} className="space-y-3">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>
                <RichLegalText text={paragraph} />
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 ? (
              <ul className="list-disc space-y-2 pl-5">
                {section.bullets.map((item) => (
                  <li key={item.slice(0, 48)}>
                    <RichLegalText text={item} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        {doc.relatedLinks.length > 0 ? (
          <p className="pt-4 text-sm text-zinc-500">
            {doc.relatedLinks.map((link, index) => (
              <span key={link.href}>
                {index > 0 ? ' · ' : null}
                <Link className="text-emerald-700 underline" href={link.href}>
                  {link.label}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </section>
    </main>
  );
}
