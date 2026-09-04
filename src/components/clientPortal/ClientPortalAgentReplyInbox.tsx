import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { ackPortalAgentReply } from '../../services/clientPortalService';
import type { AgentOfferReplyCard } from '../../utils/clientPortalFeedback';

export default function ClientPortalAgentReplyInbox({
  portalToken,
  replies,
  canInteract,
  colors,
  onOpenOffer,
  onDone,
}: {
  portalToken: string;
  replies: AgentOfferReplyCard[];
  canInteract: boolean;
  colors: { card: string; text: string; secondary: string; border: string; gold: string };
  onOpenOffer: (matchId: number) => void;
  onDone: () => void;
}) {
  const unread = replies.filter((item) => item.unread);
  const [busyId, setBusyId] = useState<number | null>(null);
  if (!unread.length) return null;

  const ack = async (matchId: number, openAfter?: boolean) => {
    if (!canInteract) return;
    setBusyId(matchId);
    try {
      await ackPortalAgentReply(portalToken, matchId);
      onDone();
      if (openAfter) onOpenOffer(matchId);
    } catch (error: unknown) {
      Alert.alert('Odpowiedź agenta', error instanceof Error ? error.message : 'Nie udało się potwierdzić odczytu.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View
      style={{
        marginBottom: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F59E0B',
        backgroundColor: '#F59E0B18',
        padding: 16,
      }}
    >
      <Text style={{ color: '#B45309', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }}>
        WYMAGA TWOJEJ REAKCJI · {unread.length} {unread.length === 1 ? 'ODPOWIEDŹ AGENTA' : 'ODPOWIEDZI AGENTA'}
      </Text>
      <Text style={{ color: colors.secondary, marginTop: 4, fontSize: 13 }}>
        Agent odpisał przy konkretnej ofercie — przeczytaj odpowiedź tutaj, nie w czacie.
      </Text>
      {unread.map((item) => (
        <View
          key={item.matchId}
          style={{
            marginTop: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 12,
          }}
        >
          <Text style={{ color: '#B45309', fontSize: 11, fontWeight: '900' }}>
            DO PRZECZYTANIA · {item.offerTitle}
          </Text>
          {item.clientNote ? (
            <View style={{ marginTop: 10, borderRadius: 12, backgroundColor: `${colors.border}66`, padding: 10 }}>
              <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '800' }}>TWOJE PYTANIE</Text>
              <Text style={{ color: colors.text, marginTop: 4, lineHeight: 20 }}>{item.clientNote}</Text>
            </View>
          ) : null}
          <View
            style={{
              marginTop: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#F59E0B66',
              backgroundColor: '#F59E0B14',
              padding: 10,
            }}
          >
            <Text style={{ color: '#B45309', fontSize: 10, fontWeight: '800' }}>ODPOWIEDŹ AGENTA</Text>
            <Text style={{ color: colors.text, marginTop: 4, lineHeight: 20 }}>{item.agentReply}</Text>
            {item.agentReplyAt ? (
              <Text style={{ color: colors.secondary, marginTop: 6, fontSize: 10 }}>
                {new Date(item.agentReplyAt).toLocaleString('pl-PL')}
              </Text>
            ) : null}
          </View>
          <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable
              disabled={!canInteract || busyId === item.matchId}
              onPress={() => void ack(item.matchId)}
              style={{
                minHeight: 40,
                justifyContent: 'center',
                borderRadius: 999,
                backgroundColor: '#F59E0B',
                paddingHorizontal: 16,
                opacity: canInteract ? 1 : 0.5,
              }}
            >
              {busyId === item.matchId ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>Przeczytałem</Text>
              )}
            </Pressable>
            <Pressable
              disabled={!canInteract || busyId === item.matchId}
              onPress={() => void ack(item.matchId, true)}
              style={{
                minHeight: 40,
                justifyContent: 'center',
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 16,
                opacity: canInteract ? 1 : 0.5,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 12 }}>Otwórz ofertę</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}
