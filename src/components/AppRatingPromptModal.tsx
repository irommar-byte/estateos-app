import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../i18n';
import {
  markAppRatingPromptShown,
  requestNativeStoreReview,
} from '../services/appRatingPrompt';

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Step = 'enjoy' | 'stars' | 'thanks';

export default function AppRatingPromptModal({ visible, onClose }: Props) {
  const { t } = useI18n();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const [step, setStep] = useState<Step>('enjoy');
  const [selectedStars, setSelectedStars] = useState(0);

  const colors = useMemo(
    () =>
      isDark
        ? { bg: '#1C1C1E', text: '#F5F5F7', sub: '#8E8E93', border: 'rgba(255,255,255,0.1)' }
        : { bg: '#FFFFFF', text: '#111111', sub: '#6B7280', border: 'rgba(0,0,0,0.08)' },
    [isDark],
  );

  const resetAndClose = () => {
    setStep('enjoy');
    setSelectedStars(0);
    onClose();
  };

  const handleEnjoyYes = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('stars');
  };

  const handleEnjoyNo = async () => {
    await markAppRatingPromptShown('soft');
    resetAndClose();
  };

  const handleStarPress = async (stars: number) => {
    setSelectedStars(stars);
    void Haptics.selectionAsync();

    if (stars >= 4) {
      await markAppRatingPromptShown('completed');
      await requestNativeStoreReview();
      setStep('thanks');
      return;
    }

    await markAppRatingPromptShown('soft');
    setStep('thanks');
  };

  const handleThanksClose = async () => {
    if (step === 'stars' && selectedStars === 0) {
      await markAppRatingPromptShown('declined');
    }
    resetAndClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleThanksClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          {step === 'enjoy' ? (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="heart" size={28} color="#10B981" />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{t('appRating.enjoyTitle')}</Text>
              <Text style={[styles.body, { color: colors.sub }]}>{t('appRating.enjoyBody')}</Text>
              <Pressable style={styles.primaryBtn} onPress={handleEnjoyYes}>
                <Text style={styles.primaryBtnText}>{t('appRating.enjoyYes')}</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => void handleEnjoyNo()}>
                <Text style={[styles.secondaryBtnText, { color: colors.sub }]}>{t('appRating.enjoyNo')}</Text>
              </Pressable>
            </>
          ) : null}

          {step === 'stars' ? (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="star" size={28} color="#F59E0B" />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{t('appRating.starsTitle')}</Text>
              <Text style={[styles.body, { color: colors.sub }]}>{t('appRating.starsBody')}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => void handleStarPress(n)} style={styles.starBtn}>
                    <Ionicons
                      name={selectedStars >= n ? 'star' : 'star-outline'}
                      size={36}
                      color="#F59E0B"
                    />
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.hint, { color: colors.sub }]}>{t('appRating.starsHint')}</Text>
            </>
          ) : null}

          {step === 'thanks' ? (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="checkmark-circle" size={30} color="#10B981" />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                {selectedStars >= 4 ? t('appRating.thanksHighTitle') : t('appRating.thanksLowTitle')}
              </Text>
              <Text style={[styles.body, { color: colors.sub }]}>
                {selectedStars >= 4 ? t('appRating.thanksHighBody') : t('appRating.thanksLowBody')}
              </Text>
              <Pressable style={styles.primaryBtn} onPress={() => void handleThanksClose()}>
                <Text style={styles.primaryBtnText}>{t('appRating.close')}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  primaryBtn: {
    marginTop: 18,
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: 10,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 18,
  },
  starBtn: {
    padding: 4,
  },
  hint: {
    marginTop: 12,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
