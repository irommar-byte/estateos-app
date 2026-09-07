import type { MarketingChannelId } from "@/lib/crm/marketingChannel";
import { promotionGroupLabel } from "@/lib/crm/marketingChannel";

function ChannelGlyph({ id }: { id: MarketingChannelId }) {
  if (id === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
        <path d="M13.5 21v-7.2h2.4l.36-2.76H13.5V9.3c0-.8.22-1.34 1.38-1.34h1.48V5.5c-.26-.03-1.14-.11-2.16-.11-2.14 0-3.6 1.3-3.6 3.7v2.05H8.1v2.76h2.5V21h2.9Z" />
      </svg>
    );
  }
  if (id === "olx") {
    return (
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      </svg>
    );
  }
  if (id === "otodom") {
    return (
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
        <path d="M4.5 11.2 12 4.8l7.5 6.4v8.4H14.2v-4.6h-4.4v4.6H4.5V11.2Z" />
      </svg>
    );
  }
  if (id === "estateos") {
    return (
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
        <path d="M12 3.4 14.2 9h6.2l-5 3.7 1.9 5.9L12 15.7 6.7 18.6 8.6 12.7 3.6 9h6.2L12 3.4Z" />
      </svg>
    );
  }
  if (id === "gratka") {
    return (
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
        <path d="M8.2 6.2h7.1v2.4H11v2.2h3.6v2.3H11V18H8.2V6.2Z" />
      </svg>
    );
  }
  if (id === "morizon") {
    return (
      <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
        <path d="M5.4 17.8V6.2h2.6l4 6.6 4-6.6h2.6v11.6h-2.6V10.4l-4 6.4-4-6.4v7.4H5.4Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M12 4.2a7.8 7.8 0 1 0 0 15.6 7.8 7.8 0 0 0 0-15.6Zm0 1.8c1.3 0 2.5.7 3.4 1.8H8.6A5.8 5.8 0 0 1 12 6Zm-5.7 5.2h11.4A6 6 0 0 1 12 16.2 6 6 0 0 1 6.3 11.2Z" />
    </svg>
  );
}

export default function MarketingChannelBrand({
  id,
  label,
  compact = false,
}: {
  id: MarketingChannelId;
  label?: string;
  compact?: boolean;
}) {
  const groupId = id === "system" ? "portal" : id;
  const word = label || promotionGroupLabel(groupId);
  return (
    <span className={`marketing-channel-brand${compact ? " marketing-channel-brand--compact" : ""}`}>
      <span className={`marketing-channel-brand__mark marketing-channel-brand__mark--${groupId}`} aria-hidden>
        <ChannelGlyph id={groupId} />
      </span>
      <span className="marketing-channel-brand__word">{word}</span>
    </span>
  );
}
