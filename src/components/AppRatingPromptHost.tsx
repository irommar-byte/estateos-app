import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AppRatingPromptModal from './AppRatingPromptModal';
import {
  bootstrapAppRatingSession,
  shouldOfferAppRatingPrompt,
  subscribeAppRatingPromptEvaluation,
} from '../services/appRatingPrompt';

export default function AppRatingPromptHost() {
  const [visible, setVisible] = useState(false);

  const evaluate = useCallback(async () => {
    if (visible) return;
    const ok = await shouldOfferAppRatingPrompt();
    if (ok) setVisible(true);
  }, [visible]);

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

  return (
    <AppRatingPromptModal
      visible={visible}
      onClose={() => setVisible(false)}
    />
  );
}
