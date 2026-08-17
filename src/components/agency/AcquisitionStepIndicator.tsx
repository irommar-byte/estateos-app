import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type StepItem = {
  id: number;
  title: string;
};

export default function AcquisitionStepIndicator({
  steps,
  currentStep,
  completedSteps = [],
  onSelectStep,
  isDark,
}: {
  steps: StepItem[];
  currentStep: number;
  completedSteps?: number[];
  onSelectStep: (stepId: number) => void;
  isDark?: boolean;
}) {
  const activeColor = '#34C759'; // Apple Green
  const mutedBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
  const mutedBg = isDark ? '#2C2C2E' : '#E5E5EA';
  const mutedText = isDark ? '#8E8E93' : '#8E8E93';
  const textColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isDone = completedSteps.includes(step.id) || step.id < currentStep;
          const showLine = index < steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              <Pressable onPress={() => onSelectStep(step.id)} style={styles.stepTouch}>
                <View
                  style={[
                    styles.circle,
                    {
                      borderColor: isActive ? activeColor : isDone ? activeColor : mutedBorder,
                      backgroundColor: isActive ? activeColor : isDone ? (isDark ? 'rgba(52,199,89,0.2)' : 'rgba(52,199,89,0.12)') : mutedBg,
                    },
                  ]}
                >
                  {isDone && !isActive ? (
                    <Ionicons name="checkmark" size={16} color={activeColor} />
                  ) : (
                    <Text
                      style={[
                        styles.circleText,
                        {
                          color: isActive ? '#000' : isDone ? activeColor : mutedText,
                          fontWeight: isActive ? '900' : '700',
                        },
                      ]}
                    >
                      {step.id}
                    </Text>
                  )}
                </View>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.title,
                    {
                      color: isActive ? activeColor : isDone ? textColor : mutedText,
                      fontWeight: isActive ? '800' : '600',
                    },
                  ]}
                >
                  {step.title}
                </Text>
              </Pressable>

              {showLine && (
                <View
                  style={[
                    styles.connectingLine,
                    {
                      backgroundColor: isDone ? activeColor : mutedBorder,
                    },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  stepTouch: {
    alignItems: 'center',
    width: 68,
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  circleText: {
    fontSize: 14,
  },
  title: {
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  connectingLine: {
    height: 2,
    width: 24,
    marginTop: -16,
    borderRadius: 1,
  },
});
