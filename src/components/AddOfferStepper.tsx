import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ADD_OFFER_TOTAL_STEPS, getStepBlockMessage, isStepValid } from '../screens/AddOffer/flow';

type AddOfferStepperProps = {
  currentStep: number;
  draft: any;
  theme: any;
  navigation: any;
  onBeforeStepChange?: (targetStep: number) => boolean;
};

export default function AddOfferStepper({ currentStep, draft, theme, navigation, onBeforeStepChange }: AddOfferStepperProps) {
  const canMoveForward = isStepValid(currentStep, draft);
  const completedStep = currentStep > 1 && isStepValid(currentStep - 1, draft);

  const goToStep = (targetStep: number) => {
    if (targetStep <= currentStep) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate(`Step${targetStep}`);
      return;
    }

    if (targetStep > currentStep + 1) {
      Alert.alert('Przejdź krok po kroku', 'Możesz przejść tylko do kolejnego kroku.');
      return;
    }

    if (!canMoveForward) {
      Alert.alert('Uzupełnij dane', getStepBlockMessage(currentStep));
      return;
    }

    if (onBeforeStepChange && !onBeforeStepChange(targetStep)) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate(`Step${targetStep}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.subtitle }]}>KROK {currentStep} Z {ADD_OFFER_TOTAL_STEPS}</Text>
        <Text style={[styles.hint, { color: canMoveForward ? '#34C759' : '#FF9F0A' }]}>
          {canMoveForward ? 'Możesz iść dalej' : 'Uzupełnij ten krok'}
        </Text>
      </View>

      <View style={styles.stepperRow}>
        {Array.from({ length: ADD_OFFER_TOTAL_STEPS }).map((_, index) => {
          const step = index + 1;
          const isActive = step === currentStep;
          const isDone = step < currentStep || (step === currentStep && completedStep);
          const isLocked = step > currentStep + 1 || (step === currentStep + 1 && !canMoveForward);

          return (
            <React.Fragment key={step}>
              <Pressable
                onPress={() => goToStep(step)}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive ? '#10b981' : isDone ? '#34C759' : theme.glass === 'dark' ? '#2C2C2E' : '#E5E5EA',
                    borderColor: isActive ? '#10b981' : isDone ? '#34C759' : 'transparent',
                    opacity: isLocked ? 0.55 : 1,
                  },
                ]}
              >
                <Text style={[styles.dotText, { color: isActive || isDone ? '#fff' : theme.subtitle }]}>{step}</Text>
              </Pressable>

              {step < ADD_OFFER_TOTAL_STEPS && (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor:
                        step < currentStep || (step === currentStep && canMoveForward)
                          ? '#34C759'
                          : theme.glass === 'dark'
                            ? 'rgba(255,255,255,0.12)'
                            : 'rgba(0,0,0,0.12)',
                    },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 22 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  hint: { fontSize: 11, fontWeight: '700' },
  stepperRow: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dotText: { fontSize: 12, fontWeight: '800' },
  connector: { flex: 1, height: 3, borderRadius: 2, marginHorizontal: 6 },
});
