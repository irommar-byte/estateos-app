type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

/** Server-safe JSON-LD script for SEO structured data. */
export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
