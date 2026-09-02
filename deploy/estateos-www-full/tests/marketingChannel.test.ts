import test from "node:test";
import assert from "node:assert/strict";
import {
  extractFacebookDestinations,
  facebookShareRecordGate,
  formatPublicationStatus,
  listingThumbnailFallback,
  parseFacebookDestination,
  publicationHeadline,
  resolveMarketingChannel,
} from "../src/lib/crm/marketingChannel";

test("parseFacebookDestination reads group slug and name", () => {
  const dest = parseFacebookDestination(
    "https://www.facebook.com/groups/sprzedam.mieszkania.warszawa/posts/123/",
  );
  assert.equal(dest?.groupSlug, "sprzedam.mieszkania.warszawa");
  assert.equal(dest?.groupName, "Sprzedam mieszkania warszawa");
  assert.equal(
    dest?.groupUrl,
    "https://www.facebook.com/groups/sprzedam.mieszkania.warszawa/",
  );
});

test("resolveMarketingChannel distinguishes estateos, facebook and otodom", () => {
  assert.equal(
    resolveMarketingChannel({ kind: "ESTATEOS_PROMOTED" }).id,
    "estateos",
  );
  assert.equal(
    resolveMarketingChannel({
      kind: "EXTERNAL_PORTAL_LISTED",
      url: "https://www.facebook.com/groups/123456789/",
    }).id,
    "facebook",
  );
  assert.equal(
    resolveMarketingChannel({
      kind: "EXTERNAL_PORTAL_LISTED",
      siteName: "Otodom",
      url: "https://www.otodom.pl/pl/oferta/x",
    }).id,
    "otodom",
  );
});

test("publicationHeadline uses Facebook group name", () => {
  assert.equal(
    publicationHeadline({
      kind: "EXTERNAL_PORTAL_LISTED",
      url: "https://facebook.com/groups/abc.def",
      groupName: "Warszawa mieszkania",
    }),
    "Opublikowano na Facebooku · Warszawa mieszkania",
  );
});

test("extractFacebookDestinations groups by group url", () => {
  const dest = extractFacebookDestinations([
    {
      createdAt: "2026-09-01T10:00:00.000Z",
      offerId: 1,
      url: "https://www.facebook.com/groups/abc/posts/1",
      kind: "EXTERNAL_PORTAL_LISTED",
    },
    {
      createdAt: "2026-09-02T10:00:00.000Z",
      offerId: 2,
      url: "https://www.facebook.com/groups/abc/posts/2",
      kind: "EXTERNAL_PORTAL_LISTED",
    },
    {
      createdAt: "2026-09-03T10:00:00.000Z",
      siteName: "Otodom",
      url: "https://www.otodom.pl/x",
      kind: "EXTERNAL_PORTAL_LISTED",
    },
  ]);
  assert.equal(dest.length, 1);
  assert.equal(dest[0].postCount, 2);
  assert.equal(dest[0].lastOfferId, 2);
});

test("formatPublicationStatus maps waiting states", () => {
  assert.equal(formatPublicationStatus("active"), "Aktywna");
  assert.equal(formatPublicationStatus("pending"), "Czeka na aktywację");
});

test("facebook share is recorded only after confirm or post url", () => {
  assert.equal(facebookShareRecordGate({}), false);
  assert.equal(facebookShareRecordGate({ confirmed: true }), true);
  assert.equal(
    facebookShareRecordGate({ postUrl: "https://facebook.com/groups/a/posts/1" }),
    true,
  );
});

test("facebook channel keeps group name even when url is the listing share page", () => {
  const channel = resolveMarketingChannel({
    kind: "EXTERNAL_PORTAL_LISTED",
    url: "https://estateos.pl/oferta/12",
    groupName: "Warszawa mieszkania",
    groupUrl: "https://www.facebook.com/groups/warszawa.mieszkania/",
  });
  assert.equal(channel.id, "facebook");
  assert.equal(channel.label, "Warszawa mieszkania");
});

test("listing thumbnail falls back for EstateOS and Facebook", () => {
  assert.equal(
    listingThumbnailFallback({
      image: null,
      channelId: "facebook",
      listingImage: "https://cdn.example/a.jpg",
    }),
    "https://cdn.example/a.jpg",
  );
  assert.equal(
    listingThumbnailFallback({
      image: null,
      channelId: "otodom",
      listingImage: "https://cdn.example/a.jpg",
    }),
    null,
  );
});
