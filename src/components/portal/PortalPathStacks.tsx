"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import ListingPathEventCard, {
  type ListingPathEvent,
} from "@/components/portal/ListingPathEventCard";
import MarketingChannelBrand from "@/components/portal/MarketingChannelBrand";
import {
  groupPromotionsByChannel,
  isActivePublicationStatus,
  type PromotionChannelGroup,
} from "@/lib/crm/marketingChannel";
import {
  groupPortalPath,
  marketReportPortalPath,
  promotionChannelFoldSummary,
  type PortalStackKind,
} from "@/lib/crm/portalActivityStacks";

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PromotionChannelSection({
  group,
  listingImage,
  token,
}: {
  group: PromotionChannelGroup<ListingPathEvent>;
  listingImage?: string | null;
  token: string;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = group.items.filter((item) => isActivePublicationStatus(item.status)).length;
  const summary = promotionChannelFoldSummary({
    count: group.items.length,
    latestAt: group.latestAt,
    activeCount,
  });

  return (
    <section className={`listing-path-channel ${open ? "listing-path-channel--open" : ""}`}>
      <button
        type="button"
        className="listing-path-channel__toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MarketingChannelBrand id={group.id} label={group.label} />
        <span className="listing-path-channel__summary">{summary}</span>
        <ChevronDown
          className={`listing-path-channel__chevron ${open ? "listing-path-channel__chevron--open" : ""}`}
          aria-hidden
        />
      </button>
      {open
        ? group.items.map((item) => (
            <ListingPathEventCard
              key={item.id}
              item={item}
              fallbackImage={listingImage}
              token={token}
            />
          ))
        : null}
    </section>
  );
}

export default function PortalPathStacks({
  token,
  listingPath,
  listingImage,
  activePortals,
}: {
  token: string;
  listingPath: ListingPathEvent[];
  listingImage?: string | null;
  activePortals?: string[];
}) {
  const stacks = useMemo(
    () => groupPortalPath(listingPath, { activePortals }),
    [listingPath, activePortals],
  );
  const [open, setOpen] = useState<Partial<Record<PortalStackKind, boolean>>>({});

  if (!stacks.length) return null;

  return (
    <div className="space-y-3">
      {stacks.map((stack) => {
        const expanded = open[stack.kind] === true;
        const countLabel =
          stack.items.length === 1 ? "1 wpis" : `${stack.items.length} wpisy`;
        return (
          <article key={stack.kind} className={`listing-path-stack listing-path-stack--${stack.kind}`}>
            <button
              type="button"
              className="listing-path-stack__toggle"
              aria-expanded={expanded}
              onClick={() =>
                setOpen((current) => ({ ...current, [stack.kind]: !expanded }))
              }
            >
              <div className="min-w-0 flex-1 text-left">
                <p className="listing-path-stack__kicker">{stack.kicker}</p>
                <h3 className="listing-path-stack__title">{stack.label}</h3>
                <p className="listing-path-stack__summary">{stack.summary}</p>
                <p className="listing-path-stack__meta">
                  {countLabel}
                  {stack.latestAt ? ` · ost. ${formatWhen(stack.latestAt)}` : ""}
                </p>
              </div>
              <ChevronDown
                className={`listing-path-stack__chevron ${expanded ? "listing-path-stack__chevron--open" : ""}`}
                aria-hidden
              />
            </button>
            {stack.kind === "reports" && stack.items[0] ? (
              <a
                href={marketReportPortalPath(token, stack.items[0].id)}
                className="listing-path-stack__open"
              >
                Otwórz {stack.items.length === 1 ? "raport" : "ostatni raport"}
              </a>
            ) : null}
            {expanded ? (
              <div className="listing-path-stack__body">
                {stack.kind === "promotions"
                  ? groupPromotionsByChannel(stack.items as ListingPathEvent[]).map((group) => (
                      <PromotionChannelSection
                        key={group.id}
                        group={group}
                        listingImage={listingImage}
                        token={token}
                      />
                    ))
                  : stack.items.map((item) => (
                      <ListingPathEventCard
                        key={item.id}
                        item={item as ListingPathEvent}
                        fallbackImage={listingImage}
                        token={token}
                      />
                    ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
