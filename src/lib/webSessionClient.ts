export type WebSessionUser = {
  id: number;
  role?: string;
  name?: string | null;
};

export async function fetchCurrentWebUser(): Promise<WebSessionUser | null> {
  try {
    const res = await fetch('/api/user/profile', { cache: 'no-store', credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const rawId = data?.id ?? data?.user?.id;
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return {
      id,
      role: data?.role ?? data?.user?.role,
      name: data?.name ?? data?.user?.name ?? null,
    };
  } catch {
    return null;
  }
}
