import test from "node:test";
import assert from "node:assert/strict";
import {
  extractFacebookDestinations,
  listingThumbnailFallback,
  parseFacebookDestination,
  publicationHeadline,
  resolveMarketingChannel,
} from "../src/lib/marketingChannel";

test("mobile marketingChannel parses Facebook groups", () => {
  const dest = parseFacebookDestination(
    "https://www.facebook.com/groups/abc.def/posts/9",
  );
  assert.equal(dest?.groupName, "Abc def");
  assert.equal(resolveMarketingChannel({ url: dest?.postUrl }).id, "facebook");
  assert.match(
    publicationHeadline({
      kind: "EXTERNAL_PORTAL_LISTED",
      url: dest?.postUrl,
      groupName: dest?.groupName,
    }),
    /Facebook/,
  );
});

test("mobile extractFacebookDestinations keeps unique groups", () => {
  const dest = extractFacebookDestinations([
    {
      createdAt: "2026-09-01T00:00:00.000Z",
      url: "https://facebook.com/groups/one/posts/1",
      kind: "EXTERNAL_PORTAL_LISTED",
    },
    {
      createdAt: "2026-09-02T00:00:00.000Z",
      url: "https://facebook.com/groups/one/posts/2",
      kind: "EXTERNAL_PORTAL_LISTED",
    },
  ]);
  assert.equal(dest.length, 1);
  assert.equal(dest[0].postCount, 2);
});

test("facebook channel keeps group name when listing url is EstateOS", () => {
  const channel = resolveMarketingChannel({
    kind: "EXTERNAL_PORTAL_LISTED",
    url: "https://estateos.pl/oferta/12",
    groupName: "Warszawa mieszkania",
    groupUrl: "https://www.facebook.com/groups/warszawa.mieszkania/",
  });
  assert.equal(channel.id, "facebook");
  assert.equal(channel.label, "Warszawa mieszkania");
});

test("listing thumbnail falls back for Facebook", () => {
  assert.equal(
    listingThumbnailFallback({
      image: null,
      channelId: "facebook",
      listingImage: "https://cdn.example/a.jpg",
    }),
    "https://cdn.example/a.jpg",
  );
});
