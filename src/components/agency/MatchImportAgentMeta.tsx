import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { importPortalBadgeColors, type ImportPortalBadge } from '../../lib/importPortalBadge';

export type MatchImportBrief = {
  badge: ImportPortalBadge | null;
  source?: string | null;
  url: string | null;
  titleOriginal?: string | null;
  descriptionOriginal?: string | null;
  phone?: string | null;
  agencyName?: string | null;
  contactAddress?: string | null;
  advertiserType?: string | null;
  smartAdd?: string[];
  userNote?: string | null;
};

export function PortalSourceBadge({ badge }: { badge: ImportPortalBadge | null }) {
  if (!badge) return null;
  const colors = importPortalBadgeColors(badge);
  return (
    <View style={{ backgroundColor: colors.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
      <Text style={{ color: colors.fg, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 }}>{badge}</Text>
    </View>
  );
}

export default function MatchImportAgentMeta({
  brief,
  colors,
}: {
  brief: MatchImportBrief | null | undefined;
  colors: { text: string; secondary: string };
}) {
  const [open, setOpen] = useState(false);
  if (!brief || (!brief.badge && !brief.url && !brief.descriptionOriginal && !brief.phone && !brief.smartAdd?.length)) {
    return null;
  }

  const contact = [brief.agencyName, brief.phone, brief.contactAddress].filter(Boolean).join(' · ');
  const hasComments = Boolean(
    brief.descriptionOriginal || contact || brief.smartAdd?.length || brief.userNote || brief.titleOriginal,
  );

  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <PortalSourceBadge badge={brief.badge} />
        {brief.url ? (
          <Pressable onPress={() => void Linking.openURL(brief.url!)}>
            <Text style={{ color: '#0A84FF', fontSize: 11, fontWeight: '800' }}>Oryginał na portalu</Text>
          </Pressable>
        ) : null}
        {hasComments ? (
          <Pressable onPress={() => setOpen((value) => !value)}>
            <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '800' }}>
              {open ? 'Ukryj komentarz importu' : 'Komentarz importu'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {open && hasComments ? (
        <View
          style={{
            marginTop: 8,
            borderRadius: 10,
            backgroundColor: 'rgba(123,77,255,0.08)',
            padding: 10,
            gap: 4,
          }}
        >
          <Text style={{ color: colors.secondary, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 }}>
            TYLKO DLA AGENTA
          </Text>
          {brief.titleOriginal ? (
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{brief.titleOriginal}</Text>
          ) : null}
          {contact ? <Text style={{ color: colors.text, fontSize: 12 }}>{contact}</Text> : null}
          {brief.advertiserType ? (
            <Text style={{ color: colors.secondary, fontSize: 11 }}>Ogłoszeniodawca: {brief.advertiserType}</Text>
          ) : null}
          {brief.smartAdd?.length ? (
            <Text style={{ color: colors.text, fontSize: 11 }}>Wykryte: {brief.smartAdd.join(', ')}</Text>
          ) : null}
          {brief.descriptionOriginal ? (
            <Text style={{ color: colors.secondary, fontSize: 11, lineHeight: 16 }}>{brief.descriptionOriginal}</Text>
          ) : null}
          {brief.userNote ? (
            <Text style={{ color: colors.text, fontSize: 11 }}>Notatka: {brief.userNote}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
