'use client';

import Link from 'next/link';
import { ArrowLeftRight, Building2, CalendarDays, Camera, Heart, LayoutDashboard, MessageCircle, Users } from 'lucide-react';

export type CrmProTab = 'pulpit' | 'klienci' | 'my_offers' | 'transakcje' | 'planowanie' | 'offers' | 'radar';

const ITEMS: Array<{ id: CrmProTab; label: string; Icon: typeof Users }> = [
  { id: 'pulpit', label: 'Pulpit', Icon: LayoutDashboard },
  { id: 'klienci', label: 'Klienci', Icon: Users },
  { id: 'my_offers', label: 'Ogłoszenia', Icon: Building2 },
  { id: 'transakcje', label: 'Transakcje', Icon: ArrowLeftRight },
  { id: 'planowanie', label: 'Planowanie', Icon: CalendarDays },
  { id: 'offers', label: 'Ulubione', Icon: Heart },
];

/** Boczne menu CRM (na telefonie poziomy pasek) z licznikami — jedno miejsce nawigacji po całym systemie. */
export default function CrmProRail({
  active,
  tabs,
  counts,
  hot,
  onChange,
}: {
  active: CrmProTab;
  tabs: CrmProTab[];
  counts: Partial<Record<CrmProTab, number | null>>;
  hot?: Partial<Record<CrmProTab, boolean>>;
  onChange: (tab: CrmProTab) => void;
}) {
  const items = ITEMS.filter((item) => tabs.includes(item.id));
  return (
    <nav className="crmx-rail" aria-label="Sekcje CRM">
      <div className="crmx-rail__list">
        {items.map(({ id, label, Icon }) => {
          const count = counts[id];
          return (
            <button
              key={id}
              type="button"
              aria-current={active === id ? 'page' : undefined}
              onClick={() => onChange(id)}
              className="crmx-rail__item"
            >
              <Icon strokeWidth={1.8} />
              <span>{label}</span>
              {count != null && count > 0 ? (
                <span className={`crmx-rail__count ${hot?.[id] ? 'crmx-rail__count--hot' : ''}`}>{count}</span>
              ) : null}
            </button>
          );
        })}
        <div className="crmx-rail__sep" />
        <div className="crmx-rail__extra">
          <p className="crmx-rail__label">Skróty</p>
          <Link href="/moje-konto/wiadomosci" className="crmx-rail__item">
            <MessageCircle strokeWidth={1.8} />
            <span>Wiadomości</span>
          </Link>
          <Link href="/moje-konto/sesje-zdjeciowe" className="crmx-rail__item">
            <Camera strokeWidth={1.8} />
            <span>Sesje zdjęciowe</span>
          </Link>
          <Link href="/moje-konto/firma" className="crmx-rail__item">
            <Building2 strokeWidth={1.8} />
            <span>Moje biuro</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
