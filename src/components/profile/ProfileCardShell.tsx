import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import {
  profileHeaderCardFaceStyle,
  profileHeaderCardShellStyle,
  profileListCardFaceStyle,
  profileListCardShellStyle,
} from './profileCardElevation';

type Variant = 'list' | 'header';

type Props = {
  isDark: boolean;
  children: React.ReactNode;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  faceStyle?: StyleProp<ViewStyle>;
};

export default function ProfileCardShell({
  isDark,
  children,
  variant = 'list',
  style,
  faceStyle,
}: Props) {
  const radius = variant === 'header' ? 16 : 12;
  const shellStyle = variant === 'header' ? profileHeaderCardShellStyle(isDark) : profileListCardShellStyle(isDark);
  const face = variant === 'header' ? profileHeaderCardFaceStyle(isDark) : profileListCardFaceStyle(isDark);

  return (
    <View style={[shellStyle, { borderRadius: radius }, style]}>
      <View style={[face, { borderRadius: radius }, faceStyle]}>{children}</View>
    </View>
  );
}
