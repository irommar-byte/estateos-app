import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AppRatingPromptModal from './AppRatingPromptModal';
import {
  bootstrapAppRatingSession,
  shouldOfferAppRatingPrompt,
  subscribeAppRatingPromptEvaluation,
} from '../services/appRatingPrompt';
import { useLaunchPromptSlot } from '../hooks/useLaunchPromptSlot';

export default function AppRatingPromptHost() {
  const [eligible, setEligible] = useState(false);

  const evaluate = useCallback(async () => {
    if (eligible) return;
    const ok = await shouldOfferAppRatingPrompt();
    if (ok) setEligible(true);
  }, [eligible]);

  useEffect(() => {
    void bootstrapAppRatingSession().then(() => evaluate());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void evaluate();
    });
    const unsubRating = subscribeAppRatingPromptEvaluation(() => {
      void evaluate();
    });
    return () => {
      sub.remove();
      unsubRating();
    };
  }, [evaluate]);

  const canShow = useLaunchPromptSlot('rating', eligible);

  if (!canShow) return null;

  return (
    <AppRatingPromptModal
      visible
      onClose={() => setEligible(false)}
    />
  );
}
