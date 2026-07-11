"use client";

import Link from "next/link";
import { useLocale } from "@/contexts/LocaleContext";
import { getDeleteAccountDictionary } from "@/i18n/deleteAccountDictionary";

export default function DeleteAccountPageClient() {
  const { locale } = useLocale();
  const d = getDeleteAccountDictionary(locale);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-800 dark:text-zinc-100">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mb-8 text-sm text-zinc-500">{d.updated}</p>
      <section className="space-y-6 text-[15px] leading-relaxed">
        <p>{d.intro}</p>
        <h2 className="text-xl font-semibold">{d.method1Title}</h2>
        <ol className="list-decimal space-y-2 pl-5">
          {d.method1Steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.passkeyHint}</p>
        <h2 className="text-xl font-semibold">{d.method2Title}</h2>
        <p>
          {d.method2Body.split("privacy@estateos.pl")[0]}
          <a className="text-emerald-700 underline" href="mailto:privacy@estateos.pl?subject=Usunięcie%20konta%20EstateOS">
            privacy@estateos.pl
          </a>
          {d.method2Body.split("privacy@estateos.pl")[1] || ""}
        </p>
        <h2 className="text-xl font-semibold">{d.deletedTitle}</h2>
        <ul className="list-disc space-y-2 pl-5">
          {d.deletedItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <h2 className="text-xl font-semibold">{d.retainedTitle}</h2>
        <p>
          {d.retainedBody.split(d.termsLink)[0]}
          <Link className="text-emerald-700 underline" href="/regulamin">
            {d.termsLink}
          </Link>
          {d.retainedBody.split(d.termsLink)[1] || ""}
        </p>
        <p className="pt-4 text-sm text-zinc-500">
          {d.privacyLabel}{" "}
          <Link className="text-emerald-700 underline" href={d.privacyLink}>
            {d.privacyLink}
          </Link>
        </p>
      </section>
    </main>
  );
}
