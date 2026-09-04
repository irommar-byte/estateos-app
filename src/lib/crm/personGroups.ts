export type CrmPersonIdentity = {
  id: number;
  type: 'BUYER' | 'SELLER';
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  pesel?: string | null;
  linkedUserId?: number | null;
  updatedAt: string;
};

export type CrmPersonGroup<T extends CrmPersonIdentity> = {
  key: string;
  primary: T;
  members: T[];
  types: Array<'BUYER' | 'SELLER'>;
  ids: number[];
};

export function crmPersonKey(client: CrmPersonIdentity): string {
  if (client.linkedUserId && client.linkedUserId > 0) return `u:${client.linkedUserId}`;
  const pesel = String(client.pesel || '').replace(/\D/g, '');
  if (pesel.length === 11) return `p:${pesel}`;
  const email = String(client.email || '').trim().toLowerCase();
  if (email.includes('@')) return `e:${email}`;
  const phone = String(client.phone || '').replace(/\D/g, '');
  if (phone.length >= 9) return `t:${phone.slice(-9)}`;
  return `id:${client.id}`;
}

export function formatCrmRoleLabel(types: Array<'BUYER' | 'SELLER'>): string {
  const hasSeller = types.includes('SELLER');
  const hasBuyer = types.includes('BUYER');
  if (hasSeller && hasBuyer) return 'SPRZEDAJĄCY / KUPUJĄCY';
  if (hasSeller) return 'SPRZEDAJĄCY';
  return 'KUPUJĄCY';
}

export function groupCrmClientsByPerson<T extends CrmPersonIdentity>(clients: T[]): CrmPersonGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const client of clients) {
    const key = crmPersonKey(client);
    const list = buckets.get(key);
    if (list) list.push(client);
    else buckets.set(key, [client]);
  }

  return [...buckets.entries()].map(([key, members]) => {
    const sorted = [...members].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const seller = sorted.find((item) => item.type === 'SELLER');
    const types: Array<'BUYER' | 'SELLER'> = [];
    if (sorted.some((item) => item.type === 'SELLER')) types.push('SELLER');
    if (sorted.some((item) => item.type === 'BUYER')) types.push('BUYER');
    return {
      key,
      primary: seller || sorted[0],
      members: sorted,
      types,
      ids: sorted.map((item) => item.id),
    };
  });
}
