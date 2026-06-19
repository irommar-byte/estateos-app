import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { API_URL } from '../config/network';
import { fetchAgencyMembership, patchAgencyMember, patchAgencyCompanyContact } from '../services/agencyCompanyService';
import type { AgencyTeamMember } from '../types/agencyMembership';
import { AGENCY_TITLE_OPTIONS } from '../types/agencyMembership';

const TITLE_LABELS: Record<string, string> = {
  DORADCA: 'Doradca',
  AGENT: 'Agent',
  BROKER: 'Broker',
  EXPERT: 'Expert',
  LEADER: 'Leader',
  KIEROWNIK_BIURO: 'Kierownik biura',
  ZASTEPCA_KIEROWNIKA: 'Zastępca kierownika biura',
};

function avatarUrl(image?: string | null) {
  const raw = String(image || '').trim();
  if (!raw) return null;
  return raw.startsWith('/') ? `${API_URL}${raw}` : raw;
}

function logoUrl(logo?: string | null) {
  const raw = String(logo || '').trim();
  if (!raw) return null;
  return raw.startsWith('/') ? `${API_URL}${raw}` : raw;
}

export default function AgencyOfficeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const membership = useAuthStore((s) => s.agencyMembership);
  const refreshAgencyMembership = useAuthStore((s) => s.refreshAgencyMembership);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactEditing, setContactEditing] = useState(false);
  const [contactDraft, setContactDraft] = useState({ website: '', officePhone: '', officeEmail: '' });

  const colors = useMemo(
    () => ({
      bg: isDark ? '#000000' : '#F2F2F7',
      card: isDark ? '#1C1C1E' : '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#000000',
      secondary: isDark ? '#8E8E93' : '#6C6C70',
      separator: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
      accent: '#34C759',
      accentBlue: '#007AFF',
      accentOrange: '#FF9500',
      accentRed: '#FF3B30',
    }),
    [isDark],
  );

  const isAdmin = membership?.role === 'ADMIN' && membership?.status === 'ACTIVE';
  const companyName = membership?.companyName || membership?.company?.name || user?.companyName || 'Biuro';
  const team = membership?.team || [];

  React.useEffect(() => {
    const company = membership?.company;
    if (!company) return;
    setContactDraft({
      website: company.website || '',
      officePhone: company.officePhone || '',
      officeEmail: company.officeEmail || '',
    });
  }, [membership?.company]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      await refreshAgencyMembership();
    } finally {
      setLoading(false);
    }
  }, [token, refreshAgencyMembership]);

  const handleApprove = useCallback(
    async (member: AgencyTeamMember) => {
      if (!token) return;
      setBusyId(member.id);
      try {
        const res = await patchAgencyMember(token, member.id, { status: 'ACTIVE' });
        if (!res.ok) {
          Alert.alert('Biuro', res.message || 'Nie udało się zaakceptować.');
          return;
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refreshAgencyMembership();
      } finally {
        setBusyId(null);
      }
    },
    [token, refreshAgencyMembership],
  );

  const handleReject = useCallback(
    async (member: AgencyTeamMember) => {
      if (!token) return;
      Alert.alert('Odrzucić zgłoszenie?', member.name || 'Pracownik', [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Odrzuć',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(member.id);
              try {
                const res = await patchAgencyMember(token, member.id, { status: 'REJECTED' });
                if (!res.ok) {
                  Alert.alert('Biuro', res.message || 'Nie udało się odrzucić.');
                  return;
                }
                await refreshAgencyMembership();
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ]);
    },
    [token, refreshAgencyMembership],
  );

  const handleChangeTitle = useCallback(
    (member: AgencyTeamMember) => {
      if (!token || !isAdmin) return;
      const options = AGENCY_TITLE_OPTIONS.map((key) => ({
        text: TITLE_LABELS[key] || key,
        onPress: () => {
          void (async () => {
            setBusyId(member.id);
            try {
              const res = await patchAgencyMember(token, member.id, { agentTitle: key });
              if (!res.ok) {
                Alert.alert('Stanowisko', res.message || 'Nie udało się zapisać.');
                return;
              }
              void Haptics.selectionAsync();
              await refreshAgencyMembership();
            } finally {
              setBusyId(null);
            }
          })();
        },
      }));
      Alert.alert('Stanowisko w biurze', member.name || 'Pracownik', [...options, { text: 'Anuluj', style: 'cancel' }]);
    },
    [token, isAdmin, refreshAgencyMembership],
  );

  const handleContactSave = useCallback(async () => {
    if (!token || !isAdmin) return;
    setContactBusy(true);
    try {
      const res = await patchAgencyCompanyContact(token, {
        website: contactDraft.website.trim() || null,
        officePhone: contactDraft.officePhone.trim() || null,
        officeEmail: contactDraft.officeEmail.trim() || null,
      });
      if (!res.ok) {
        Alert.alert('Dane biura', res.message || 'Nie udało się zapisać.');
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setContactEditing(false);
      await refreshAgencyMembership();
    } finally {
      setContactBusy(false);
    }
  }, [token, isAdmin, contactDraft, refreshAgencyMembership]);

  const activeTeam = team.filter((m) => m.status === 'ACTIVE');
  const pendingTeam = team.filter((m) => m.status === 'PENDING');

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.separator }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.navBack}>
          <Ionicons name="chevron-back" size={28} color={colors.accentBlue} />
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>
          {companyName}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} />}
      >
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.separator }]}>
          {logoUrl(membership?.company?.logoUrl || user?.companyLogoUrl) ? (
            <Image
              source={{ uri: logoUrl(membership?.company?.logoUrl || user?.companyLogoUrl)! }}
              style={styles.heroLogo}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.heroLogoPlaceholder, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
              <Ionicons name="business" size={36} color={colors.accentBlue} />
            </View>
          )}
          <Text style={[styles.heroTitle, { color: colors.text }]}>{companyName}</Text>
          <Text style={[styles.heroSubtitle, { color: colors.secondary }]}>
            {membership?.titleLabel || 'Pracownik biura'}
            {membership?.status === 'ACTIVE' ? ' · aktywny dostęp' : ' · oczekuje na akceptację'}
          </Text>
          {membership?.company?.address ? (
            <Text style={[styles.heroMeta, { color: colors.secondary }]}>{membership.company.address}</Text>
          ) : null}
        </View>

        {isAdmin ? (
          <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
            <View style={styles.contactHeader}>
              <Text style={[styles.sectionTitle, { color: colors.secondary, marginBottom: 0 }]}>DANE KONTAKTOWE</Text>
              {!contactEditing ? (
                <Pressable onPress={() => setContactEditing(true)} hitSlop={8}>
                  <Text style={{ color: colors.accentBlue, fontSize: 13, fontWeight: '700' }}>Edytuj</Text>
                </Pressable>
              ) : null}
            </View>
            {contactEditing ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.secondary }]}>Strona www</Text>
                <TextInput
                  value={contactDraft.website}
                  onChangeText={(website) => setContactDraft((d) => ({ ...d, website }))}
                  placeholder="https://twoje-biuro.pl"
                  placeholderTextColor={colors.secondary}
                  autoCapitalize="none"
                  keyboardType="url"
                  style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
                />
                <Text style={[styles.fieldLabel, { color: colors.secondary }]}>Telefon biura</Text>
                <TextInput
                  value={contactDraft.officePhone}
                  onChangeText={(officePhone) => setContactDraft((d) => ({ ...d, officePhone }))}
                  placeholder="+48 22 000 00 00"
                  placeholderTextColor={colors.secondary}
                  keyboardType="phone-pad"
                  style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
                />
                <Text style={[styles.fieldLabel, { color: colors.secondary }]}>E-mail biura</Text>
                <TextInput
                  value={contactDraft.officeEmail}
                  onChangeText={(officeEmail) => setContactDraft((d) => ({ ...d, officeEmail }))}
                  placeholder="biuro@twoje-biuro.pl"
                  placeholderTextColor={colors.secondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
                />
                <View style={styles.contactActions}>
                  <Pressable
                    onPress={() => void handleContactSave()}
                    disabled={contactBusy}
                    style={[styles.saveBtn, { opacity: contactBusy ? 0.6 : 1 }]}
                  >
                    {contactBusy ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.saveBtnText}>Zapisz</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setContactEditing(false);
                      setContactDraft({
                        website: membership?.company?.website || '',
                        officePhone: membership?.company?.officePhone || '',
                        officeEmail: membership?.company?.officeEmail || '',
                      });
                    }}
                    disabled={contactBusy}
                  >
                    <Text style={{ color: colors.secondary, fontWeight: '700' }}>Anuluj</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={{ gap: 8, marginTop: 10 }}>
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  {membership?.company?.website || 'Brak strony www'}
                </Text>
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  {membership?.company?.officePhone || 'Brak telefonu'}
                </Text>
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  {membership?.company?.officeEmail || 'Brak e-maila'}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {isAdmin && pendingTeam.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.secondary }]}>OCZEKUJĄCE ({pendingTeam.length})</Text>
            {pendingTeam.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                colors={colors}
                busy={busyId === member.id}
                isAdmin={isAdmin}
                onApprove={() => void handleApprove(member)}
                onReject={() => void handleReject(member)}
                onChangeTitle={() => handleChangeTitle(member)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.secondary }]}>
            ZESPÓŁ ({activeTeam.length})
          </Text>
          {activeTeam.length === 0 ? (
            <Text style={{ color: colors.secondary, paddingVertical: 12 }}>Brak aktywnych pracowników.</Text>
          ) : (
            activeTeam.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                colors={colors}
                busy={busyId === member.id}
                isAdmin={isAdmin}
                onApprove={() => void handleApprove(member)}
                onReject={() => void handleReject(member)}
                onChangeTitle={() => handleChangeTitle(member)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function MemberRow({
  member,
  colors,
  busy,
  isAdmin,
  onApprove,
  onReject,
  onChangeTitle,
}: {
  member: AgencyTeamMember;
  colors: Record<string, string>;
  busy: boolean;
  isAdmin: boolean;
  onApprove: () => void;
  onReject: () => void;
  onChangeTitle: () => void;
}) {
  const uri = avatarUrl(member.image);
  const statusColor =
    member.status === 'ACTIVE' ? colors.accent : member.status === 'PENDING' ? colors.accentOrange : colors.secondary;

  return (
    <View style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.separator }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.memberAvatar} contentFit="cover" />
      ) : (
        <View style={[styles.memberAvatar, { backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="person" size={20} color="#8E8E93" />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
          {member.name || 'Pracownik'}
          {member.isSelf ? ' (Ty)' : ''}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 12 }}>
          {member.titleLabel}
          {member.role === 'ADMIN' ? ' · Administrator' : ''}
        </Text>
        <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
          {member.status === 'ACTIVE' ? 'AKTYWNY' : member.status === 'PENDING' ? 'OCZEKUJE' : member.status}
        </Text>
      </View>
      {busy ? <ActivityIndicator color={colors.accentBlue} /> : null}
      {isAdmin && member.status === 'PENDING' ? (
        <View style={styles.adminActions}>
          <Pressable onPress={onApprove} style={[styles.actionBtn, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
            <Ionicons name="checkmark" size={18} color={colors.accent} />
          </Pressable>
          <Pressable onPress={onReject} style={[styles.actionBtn, { backgroundColor: 'rgba(255,59,48,0.12)' }]}>
            <Ionicons name="close" size={18} color={colors.accentRed} />
          </Pressable>
        </View>
      ) : null}
      {isAdmin && member.status === 'ACTIVE' && member.role !== 'ADMIN' ? (
        <Pressable onPress={onChangeTitle} hitSlop={8}>
          <Text style={{ color: colors.accentBlue, fontWeight: '600', fontSize: 12 }}>Stanowisko</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBack: { width: 44, alignItems: 'flex-start' },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  hero: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    alignItems: 'center',
    marginBottom: 18,
  },
  heroLogo: { width: 72, height: 72, borderRadius: 16, marginBottom: 12 },
  heroLogoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  heroSubtitle: { fontSize: 14, marginTop: 6, textAlign: 'center' },
  heroMeta: { fontSize: 12, marginTop: 8, textAlign: 'center' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  memberAvatar: { width: 44, height: 44, borderRadius: 12 },
  memberName: { fontSize: 16, fontWeight: '700' },
  adminActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 18,
  },
  contactHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 6, letterSpacing: 0.3 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  contactActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 14 },
  saveBtn: {
    backgroundColor: '#34C759',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 88,
    alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
});
