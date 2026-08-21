const KEY = "eos_client_portal_token";

export function rememberClientPortalToken(token: string | null | undefined) {
  if (typeof window === "undefined") return;
  const value = String(token || "").trim();
  if (!value) return;
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    /* ignore */
  }
}

export function readClientPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromPath = window.location.pathname.match(/^\/klient\/([^/?#]+)/);
  if (fromPath?.[1]) {
    rememberClientPortalToken(fromPath[1]);
    return fromPath[1];
  }
  const fromQuery = new URLSearchParams(window.location.search).get("portal");
  if (fromQuery) {
    rememberClientPortalToken(fromQuery);
    return fromQuery;
  }
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clientPortalHref(token: string) {
  return `/klient/${encodeURIComponent(token)}`;
}
