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
import {
  fetchAgencyDashboard,
  patchAgencyMember,
  patchAgencyCompanyContact,
  transferAgencyCredits,
} from '../services/agencyCompanyService';
import type { AgencyDashboardMember, AgencyDashboardPayload, AgencyTeamMember } from '../types/agencyMembership';
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

function mediaUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.startsWith('/') ? `${API_URL}${raw}` : raw;
}

function memberAvatarUrl(profilePhotoUrl?: string | null, userImage?: string | null) {
  return mediaUrl(profilePhotoUrl || userImage);
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtPrice(value: number) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString('pl-PL')} zł`;
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
  const [dashboard, setDashboard] = useState<AgencyDashboardPayload | null>(null);
  const [creditTarget, setCreditTarget] = useState<AgencyDashboardMember | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [creditBusy, setCreditBusy] = useState(false);

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
  const companyCredits = dashboard?.company?.extraListings ?? membership?.company?.extraListings ?? 0;

  React.useEffect(() => {
    const company = membership?.company;
    if (!company) return;
    setContactDraft({
      website: company.website || '',
      officePhone: company.officePhone || '',
      officeEmail: company.officeEmail || '',
    });
  }, [membership?.company]);

  const loadDashboard = useCallback(async () => {
    if (!token || !isAdmin) {
      setDashboard(null);
      return;
    }
    const data = await fetchAgencyDashboard(token);
    setDashboard(data);
  }, [token, isAdmin]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      await refreshAgencyMembership();
      await loadDashboard();
    } finally {
      setLoading(false);
    }
  }, [token, refreshAgencyMembership, loadDashboard]);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
        await loadDashboard();
      } finally {
        setBusyId(null);
      }
    },
    [token, refreshAgencyMembership, loadDashboard],
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
                await loadDashboard();
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ]);
    },
    [token, refreshAgencyMembership, loadDashboard],
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
              await loadDashboard();
            } finally {
              setBusyId(null);
            }
          })();
        },
      }));
      Alert.alert('Stanowisko w biurze', member.name || 'Pracownik', [...options, { text: 'Anuluj', style: 'cancel' }]);
    },
    [token, isAdmin, refreshAgencyMembership, loadDashboard],
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
      await loadDashboard();
    } finally {
      setContactBusy(false);
    }
  }, [token, isAdmin, contactDraft, refreshAgencyMembership, loadDashboard]);

  const handleCreditTransfer = useCallback(async () => {
    if (!token || !creditTarget) return;
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Kredyty', 'Podaj dodatnią liczbę kredytów.');
      return;
    }
    setCreditBusy(true);
    try {
      const res = await transferAgencyCredits(token, {
        toUserId: creditTarget.userId,
        amount: Math.floor(amount),
        note: creditNote.trim() || undefined,
      });
      if (!res.ok) {
        Alert.alert('Kredyty', res.message || 'Transfer nie powiódł się.');
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreditTarget(null);
      setCreditAmount('');
      setCreditNote('');
      await refreshAgencyMembership();
      await loadDashboard();
    } finally {
      setCreditBusy(false);
    }
  }, [token, creditTarget, creditAmount, creditNote, refreshAgencyMembership, loadDashboard]);

  const activeTeam = team.filter((m) => m.status === 'ACTIVE');
  const pendingTeam = team.filter((m) => m.status === 'PENDING');
  const dashboardMembers = dashboard?.members.filter((m) => m.status === 'ACTIVE') ?? [];
  const recentOffers = dashboard?.recentOffers ?? [];
  const creditTransfers = dashboard?.creditTransfers ?? [];
  const partnerPlan = dashboard?.partnerPlan ?? null;

  const PLAN_LABELS: Record<string, string> = {
    start: 'Partner Start',
    pro: 'Partner Pro',
    enterprise: 'Partner Enterprise',
  };

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
          {mediaUrl(membership?.company?.logoUrl || user?.companyLogoUrl) ? (
            <Image
              source={{ uri: mediaUrl(membership?.company?.logoUrl || user?.companyLogoUrl)! }}
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

        {isAdmin && dashboard ? (
          <View style={styles.kpiRow}>
            {[
              { label: 'Aktywni', value: dashboard.stats.activeAgents, icon: 'people' as const },
              { label: 'Oczekujący', value: dashboard.stats.pendingAgents, icon: 'time' as const },
              { label: 'Oferty', value: dashboard.stats.totalOffers, icon: 'home' as const },
              { label: 'Kredyty w puli', value: companyCredits, icon: 'wallet' as const },
            ].map((kpi) => (
              <View key={kpi.label} style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
                <Ionicons name={kpi.icon} size={16} color={colors.accent} />
                <Text style={[styles.kpiValue, { color: colors.text }]}>{kpi.value}</Text>
                <Text style={[styles.kpiLabel, { color: colors.secondary }]}>{kpi.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {isAdmin && partnerPlan ? (
          <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
            <Text style={[styles.sectionTitle, { color: colors.secondary }]}>PAKIET AGENCJI</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 8 }}>
              {partnerPlan.currentPlanId
                ? PLAN_LABELS[partnerPlan.currentPlanId] || 'Partner'
                : partnerPlan.isSubscriptionActive
                  ? 'Aktywna pula Partner'
                  : 'Brak aktywnego pakietu'}
            </Text>
            <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 6 }}>
              {partnerPlan.poolCredits} kredytów w puli
              {partnerPlan.agentsLimit != null
                ? ` · ${partnerPlan.activeAgents}/${partnerPlan.agentsLimit} agentów`
                : ` · ${partnerPlan.activeAgents} agentów`}
            </Text>
            {partnerPlan.plusExpiresAt ? (
              <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
                Ważność: {fmtDate(partnerPlan.plusExpiresAt)}
                {partnerPlan.daysRemaining != null ? ` (${partnerPlan.daysRemaining} dni)` : ''}
              </Text>
            ) : null}
            <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 10 }}>
              Pełny wybór i zmiana pakietu — w panelu na estateos.pl → Moje biuro.
            </Text>
          </View>
        ) : null}

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
            ZESPÓŁ I AKTYWNOŚĆ ({isAdmin && dashboardMembers.length ? dashboardMembers.length : activeTeam.length})
          </Text>
          {isAdmin && dashboardMembers.length > 0 ? (
            dashboardMembers.map((member) => (
              <AdminMemberRow
                key={member.id}
                member={member}
                colors={colors}
                busy={busyId === member.id}
                isAdmin={isAdmin}
                onChangeTitle={() => {
                  const stub: AgencyTeamMember = {
                    id: member.id,
                    userId: member.userId,
                    role: member.role,
                    status: member.status,
                    agentTitle: member.agentTitle,
                    titleLabel: TITLE_LABELS[member.agentTitle] || member.agentTitle,
                    name: member.user.name,
                    image: memberAvatarUrl(member.profilePhotoUrl, member.user.image),
                    isSelf: member.userId === user?.id,
                  };
                  handleChangeTitle(stub);
                }}
                onTransferCredits={() => {
                  setCreditTarget(member);
                  setCreditAmount('');
                  setCreditNote('');
                }}
              />
            ))
          ) : activeTeam.length === 0 ? (
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

        {isAdmin && creditTransfers.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.secondary }]}>HISTORIA KREDYTÓW</Text>
            {creditTransfers.slice(0, 12).map((transfer) => (
              <View
                key={transfer.id}
                style={[styles.transferRow, { backgroundColor: colors.card, borderColor: colors.separator }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    +{transfer.amount} kredytów → {transfer.toUser.name || transfer.toUser.email}
                  </Text>
                  <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
                    {fmtDate(transfer.createdAt)}
                    {transfer.note ? ` · ${transfer.note}` : ''}
                  </Text>
                  <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                    Przez: {transfer.createdBy.name || 'Administrator'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {isAdmin && recentOffers.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.secondary }]}>OSTATNIE OGŁOSZENIA BIURA</Text>
            {recentOffers.slice(0, 8).map((offer) => (
              <View
                key={offer.id}
                style={[styles.offerRow, { backgroundColor: colors.card, borderColor: colors.separator }]}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={2}>
                  {offer.title}
                </Text>
                <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
                  {offer.agent.name || 'Agent'} · {offer.city} · {fmtPrice(offer.price)}
                </Text>
                <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                  {offer.status} · {fmtDate(offer.updatedAt)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {creditTarget ? (
        <View style={[styles.creditSheet, { backgroundColor: colors.card, borderColor: colors.separator, paddingBottom: insets.bottom + 16 }]}>
          <Text style={[styles.creditSheetTitle, { color: colors.text }]}>
            Przydziel kredyty — {creditTarget.user.name || 'Pracownik'}
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 12, marginBottom: 10 }}>
            W puli biura: {companyCredits} kredytów · u pracownika: {creditTarget.user.extraListings}
          </Text>
          <TextInput
            value={creditAmount}
            onChangeText={setCreditAmount}
            placeholder="Liczba kredytów"
            placeholderTextColor={colors.secondary}
            keyboardType="number-pad"
            style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
          />
          <TextInput
            value={creditNote}
            onChangeText={setCreditNote}
            placeholder="Notatka (opcjonalnie)"
            placeholderTextColor={colors.secondary}
            style={[styles.input, { color: colors.text, borderColor: colors.separator, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', marginTop: 8 }]}
          />
          <View style={styles.contactActions}>
            <Pressable
              onPress={() => void handleCreditTransfer()}
              disabled={creditBusy}
              style={[styles.saveBtn, { opacity: creditBusy ? 0.6 : 1 }]}
            >
              {creditBusy ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Przydziel</Text>}
            </Pressable>
            <Pressable
              onPress={() => {
                setCreditTarget(null);
                setCreditAmount('');
                setCreditNote('');
              }}
              disabled={creditBusy}
            >
              <Text style={{ color: colors.secondary, fontWeight: '700' }}>Anuluj</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
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
  const uri = mediaUrl(member.image);
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

function AdminMemberRow({
  member,
  colors,
  busy,
  isAdmin,
  onChangeTitle,
  onTransferCredits,
}: {
  member: AgencyDashboardMember;
  colors: Record<string, string>;
  busy: boolean;
  isAdmin: boolean;
  onChangeTitle: () => void;
  onTransferCredits: () => void;
}) {
  const uri = memberAvatarUrl(member.profilePhotoUrl, member.user.image);
  const u = member.user;

  return (
    <View style={[styles.adminMemberCard, { backgroundColor: colors.card, borderColor: colors.separator }]}>
      <View style={styles.adminMemberHeader}>
        {uri ? (
          <Image source={{ uri }} style={styles.memberAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.memberAvatar, { backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="person" size={20} color="#8E8E93" />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
            {u.name || 'Pracownik'}
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 12 }}>
            {TITLE_LABELS[member.agentTitle] || member.agentTitle}
            {member.role === 'ADMIN' ? ' · Administrator' : ''}
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
            Ostatnie logowanie: {fmtDate(u.lastLoginAt)}
          </Text>
        </View>
        {busy ? <ActivityIndicator color={colors.accentBlue} /> : null}
      </View>

      <View style={styles.statsGrid}>
        {[
          { label: 'Oferty', value: `${u.activeOffers} aktyw.` },
          { label: 'CRM', value: String(u.crmClients) },
          { label: 'Transakcje', value: String(u.dealsInProgress) },
          { label: 'Kredyty', value: String(u.extraListings) },
        ].map((stat) => (
          <View key={stat.label} style={[styles.statCell, { backgroundColor: colors.bg }]}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{stat.value}</Text>
            <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '700', marginTop: 2 }}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 8 }}>
        {u.pendingOffers} oczekujących · {u.soldOffers} sprzedanych · {u.reviewsCount} opinii
        {u.averageRating != null ? ` · ★ ${u.averageRating}` : ''}
      </Text>

      {isAdmin && member.role !== 'ADMIN' ? (
        <View style={[styles.adminActions, { marginTop: 10, justifyContent: 'flex-end' }]}>
          <Pressable onPress={onChangeTitle} style={[styles.inlineBtn, { borderColor: colors.separator }]}>
            <Text style={{ color: colors.accentBlue, fontWeight: '700', fontSize: 12 }}>Stanowisko</Text>
          </Pressable>
          <Pressable onPress={onTransferCredits} style={[styles.inlineBtn, { borderColor: colors.accent, backgroundColor: 'rgba(52,199,89,0.1)' }]}>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>Przydziel kredyty</Text>
          </Pressable>
        </View>
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
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
  },
  kpiValue: { fontSize: 22, fontWeight: '900' },
  kpiLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
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
  adminMemberCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  adminMemberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memberAvatar: { width: 44, height: 44, borderRadius: 12 },
  memberName: { fontSize: 16, fontWeight: '700' },
  adminActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  inlineBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  statCell: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  transferRow: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 8,
  },
  offerRow: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 8,
  },
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
  creditSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  creditSheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
});
