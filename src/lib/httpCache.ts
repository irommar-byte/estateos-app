import { NextResponse } from "next/server";

/** Attach CDN-friendly cache headers to a JSON API response. */
export function jsonWithCache<T>(
  data: T,
  init?: ResponseInit,
  opts?: { maxAge?: number; swr?: number },
): NextResponse<T> {
  const maxAge = opts?.maxAge ?? 60;
  const swr = opts?.swr ?? 300;
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`);
  return res;
}

export function attachCacheHeaders(res: NextResponse, maxAge = 60, swr = 300): NextResponse {
  res.headers.set("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`);
  return res;
}
