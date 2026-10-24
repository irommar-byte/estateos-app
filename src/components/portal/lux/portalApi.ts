/** Wywołanie akcji panelu klienta (POST /api/crm/client-portal/[token]). */
export async function portalAction<T = Record<string, unknown>>(
  token: string,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(`/api/crm/client-portal/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(json.error || "Coś poszło nie tak. Spróbuj ponownie."));
  return json as T;
}

export function formatPln(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${Math.round(Number(value)).toLocaleString("pl-PL")} zł`;
}
