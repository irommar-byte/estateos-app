import { Platform, StyleSheet, type ViewStyle } from 'react-native';

export function profileListCardShellStyle(isDark: boolean): ViewStyle {
  return isDark
    ? {
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: Platform.OS === 'ios' ? 0.58 : 0.42,
        shadowRadius: 20,
        elevation: 12,
      }
    : {
        borderRadius: 12,
        shadowColor: '#253041',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: Platform.OS === 'ios' ? 0.17 : 0.13,
        shadowRadius: 18,
        elevation: 8,
      };
}

export function profileListCardFaceStyle(isDark: boolean): ViewStyle {
  return {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
    borderColor: isDark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.07)',
  };
}

export function profileHeaderCardShellStyle(isDark: boolean): ViewStyle {
  return isDark
    ? {
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: Platform.OS === 'ios' ? 0.62 : 0.45,
        shadowRadius: 22,
        elevation: 14,
      }
    : {
        borderRadius: 16,
        shadowColor: '#253041',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: Platform.OS === 'ios' ? 0.2 : 0.15,
        shadowRadius: 20,
        elevation: 10,
      };
}

export function profileHeaderCardFaceStyle(isDark: boolean): ViewStyle {
  return {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
    borderColor: isDark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.07)',
  };
}

export function profilePremiumCardShellStyle(isDark: boolean, radius = 20): ViewStyle {
  return {
    borderRadius: radius,
    ...(isDark
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: Platform.OS === 'ios' ? 0.64 : 0.46,
          shadowRadius: 24,
          elevation: 14,
        }
      : {
          shadowColor: '#1E2634',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: Platform.OS === 'ios' ? 0.22 : 0.16,
          shadowRadius: 22,
          elevation: 11,
        }),
  };
}
