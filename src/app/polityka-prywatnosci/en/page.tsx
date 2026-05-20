import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | EstateOS™",
  description:
    "How EstateOS™ collects, uses, and protects personal data, including user content, identifiers, and location.",
  alternates: { canonical: "https://estateos.pl/polityka-prywatnosci/en" },
};

const UPDATED = "May 15, 2026";

export default function PrivacyPolicyEnPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-zinc-800">
      <p className="mb-2 text-sm text-zinc-500">
        <Link className="text-emerald-700 underline" href="/polityka-prywatnosci">
          ← Polish version
        </Link>
      </p>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mb-8 text-sm text-zinc-500">EstateOS™ — Last updated: {UPDATED}</p>

      <section className="space-y-6 text-[15px] leading-relaxed">
        <p>
          This Privacy Policy describes how <strong>EstateOS™</strong> (“we”, “us”, “our”) processes personal
          information when you use our website, mobile applications, and related services (together, the
          “Services”). By using the Services, you agree to this Privacy Policy. If you do not agree, please do
          not use the Services.
        </p>

        <h2 className="text-xl font-semibold">1. Who we are</h2>
        <p>
          The data controller for personal information collected through the Services is the operator of
          EstateOS™. For privacy requests, contact:{" "}
          <a className="text-emerald-700 underline" href="mailto:privacy@estateos.pl">
            privacy@estateos.pl
          </a>
          .
        </p>

        <h2 className="text-xl font-semibold">2. Categories of personal information we process</h2>
        <p>Depending on how you use the Services, we may process the following categories of data:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Identifiers</strong> — for example: name, email address, account identifiers, online
            identifiers (such as authentication tokens, device or push notification tokens where applicable), and
            similar data used to operate accounts and secure access.
          </li>
          <li>
            <strong>User content</strong> — for example: property listing content (descriptions, images, metadata
            you submit), profile information, messages and other content you choose to upload or send through the
            Services.
          </li>
          <li>
            <strong>Location</strong> — for example: approximate or precise location when you enable location-based
            features (such as map search, nearby listings, or location-enhanced discovery), as permitted by your
            device settings and applicable law.
          </li>
          <li>
            <strong>Technical and usage data</strong> — for example: IP address, device/browser type, diagnostic
            logs, and product analytics needed to maintain security, reliability, and improve the Services.
          </li>
        </ul>

        <h2 className="text-xl font-semibold">3. How we use personal information</h2>
        <p>We use personal information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide, operate, maintain, and improve the Services;</li>
          <li>Create and manage accounts, authenticate users, and prevent fraud and abuse;</li>
          <li>
            Deliver features you request (including listings, messaging, notifications, and map-related features);
          </li>
          <li>Communicate with you about the Services, support requests, and important notices;</li>
          <li>Comply with legal obligations and enforce our terms.</li>
        </ul>

        <h2 className="text-xl font-semibold">4. Legal bases (where applicable)</h2>
        <p>
          If GDPR or similar laws apply, we rely on appropriate legal bases such as: performance of a contract,
          legitimate interests (for example security, fraud prevention, service improvement), consent where
          required (for example certain marketing or optional analytics/location features), and legal obligations.
        </p>

        <h2 className="text-xl font-semibold">5. Sharing of personal information</h2>
        <p>We may share personal information with:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Service providers</strong> who assist us with hosting, email delivery, analytics, customer
            support, security, payments (if applicable), and similar functions, under contractual safeguards;
          </li>
          <li>
            <strong>Other users</strong> when you choose to publish content (for example listing details) or send
            messages through the Services;
          </li>
          <li>
            <strong>Authorities</strong> when required by law or to protect rights, safety, and security.
          </li>
        </ul>
        <p>We do not sell your personal information.</p>

        <h2 className="text-xl font-semibold">6. Retention</h2>
        <p>
          We retain personal information for as long as needed to provide the Services, comply with legal
          obligations, resolve disputes, and enforce agreements. Retention periods may vary depending on the data
          category and context.
        </p>

        <h2 className="text-xl font-semibold">7. Security</h2>
        <p>
          We implement technical and organizational measures designed to protect personal information. However, no
          method of transmission or storage is completely secure.
        </p>

        <h2 className="text-xl font-semibold">8. International transfers</h2>
        <p>
          If we transfer personal information across borders, we use appropriate safeguards as required by applicable
          law.
        </p>

        <h2 className="text-xl font-semibold">9. Your rights and choices</h2>
        <p>
          Depending on your location, you may have rights to access, correct, delete, restrict, or object to certain
          processing, and to data portability. You may also withdraw consent where processing is based on consent. To
          exercise rights, contact us at{" "}
          <a className="text-emerald-700 underline" href="mailto:privacy@estateos.pl">
            privacy@estateos.pl
          </a>
          . You can control certain device permissions (such as location or notifications) through your device
          settings.
        </p>

        <h2 className="text-xl font-semibold">10. Children</h2>
        <p>
          The Services are not directed to children under the age where parental consent is required for data
          processing in your region, and we do not knowingly collect personal information from such children.
        </p>

        <h2 className="text-xl font-semibold">11. Third-party services</h2>
        <p>
          The Services may contain links or integrations with third parties. Their processing is governed by their
          own policies. Apple may process certain data in connection with App Store distribution; see Apple’s privacy
          disclosures for details.
        </p>

        <h2 className="text-xl font-semibold">12. Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the updated version on this page and
          update the “Last updated” date.
        </p>

        <h2 className="text-xl font-semibold">13. Contact</h2>
        <p>
          Questions about this Privacy Policy:{" "}
          <a className="text-emerald-700 underline" href="mailto:privacy@estateos.pl">
            privacy@estateos.pl
          </a>
        </p>

        <p className="pt-4 text-sm text-zinc-500">
          Terms of service:{" "}
          <Link className="text-emerald-700 underline" href="/regulamin">
            /regulamin
          </Link>
        </p>
      </section>
    </main>
  );
}
