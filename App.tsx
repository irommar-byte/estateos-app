import * as Device from "expo-device";
import { usePushNotifications } from "./src/hooks/usePushNotifications";
import PushOnboardingSheet from "./src/components/PushOnboardingSheet";
import DealroomChatScreen from './src/screens/DealroomChatScreen';
import AppleSplashScreen from "./src/components/AppleSplashScreen";
import OfferDetail from './src/screens/OfferDetail';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Pressable, Animated, Alert, useColorScheme, ScrollView } from 'react-native';

import * as Notifications from "expo-notifications";

Notifications.addNotificationReceivedListener(notification => {
  console.log("📩 FULL NOTIFICATION:", JSON.stringify(notification, null, 2));
});

import { createNavigationContainerRef } from "@react-navigation/native";

import { NavigationContainer, DarkTheme, DefaultTheme, useNavigation, useNavigationState } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useThemeStore, ThemeMode } from './src/store/useThemeStore';
import { useOfferStore } from './src/store/useOfferStore';
import { useAuthStore } from './src/store/useAuthStore';
import AppleHover from './src/components/AppleHover';

import Radar from './src/screens/Radar';
import RadarHomeScreen from './src/screens/RadarHomeScreen';
import Step1_Type from './src/screens/AddOffer/Step1_Type';
import Step2_Location from './src/screens/AddOffer/Step2_Location';
import Step3_Parameters from './src/screens/AddOffer/Step3_Parameters';
import Step4_Finance from './src/screens/AddOffer/Step4_Finance';
import Step5_Media from './src/screens/AddOffer/Step5_Media';
import Step6_Summary from './src/screens/AddOffer/Step6_Summary';
import AuthScreen from './src/screens/AuthScreen';
import { getStepBlockMessage, isStepValid } from './src/screens/AddOffer/flow';

const Colors = {
  light: { background: '#f5f5f7', text: '#1d1d1f', subtitle: '#86868b', glass: 'light' as const },
  dark: { background: '#000000', text: '#f5f5f7', subtitle: '#86868b', glass: 'dark' as const },
  primary: '#10b981'
};

import ProfileScreen from './src/screens/ProfileScreen';
import EditOfferScreen from './src/screens/EditOfferScreen';
import TermsScreen from './src/screens/TermsScreen';
import SmsVerificationScreen from './src/screens/SmsVerificationScreen';
import DealroomListScreen from './src/screens/DealroomListScreen';

const navigationRef = createNavigationContainerRef();

const AddOfferStack = createNativeStackNavigator();
function AddOfferNavigator({ theme }: { theme: any }) {
  return (
    <AddOfferStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <AddOfferStack.Screen name="Step1">{props => <Step1_Type {...props} theme={theme} />}</AddOfferStack.Screen>
      <AddOfferStack.Screen name="Step2">{props => <Step2_Location {...props} theme={theme} />}</AddOfferStack.Screen>
      <AddOfferStack.Screen name="Step3">{props => <Step3_Parameters {...props} theme={theme} />}</AddOfferStack.Screen>
      <AddOfferStack.Screen name="Step4">{props => <Step4_Finance {...props} theme={theme} />}</AddOfferStack.Screen>
      <AddOfferStack.Screen name="Step5">{props => <Step5_Media {...props} theme={theme} />}</AddOfferStack.Screen>
      <AddOfferStack.Screen name="Step6">{props => <Step6_Summary {...props} theme={theme} />}</AddOfferStack.Screen>
    </AddOfferStack.Navigator>
  );
}

const FloatingNextButton = ({ onPress }: any) => {
  const { draft, currentStep } = useOfferStore();
  const user = useAuthStore(state => state.user); 
  const isLoggedIn = !!user;
  const navigation = useNavigation<any>();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const themeMode = useThemeStore(s => s.themeMode);
  const isDark = themeMode === 'dark';

  const activeRouteName = useNavigationState(state => state?.routes[state.index]?.name || 'Radar');
  const isFocused = activeRouteName === 'Dodaj';

  let isValid = false;
  let errorMessage = getStepBlockMessage(currentStep);
  if (currentStep >= 1 && currentStep <= 5) {
    isValid = isStepValid(currentStep, draft);
    errorMessage = getStepBlockMessage(currentStep);
  }

  useEffect(() => {
    if (isValid && currentStep > 0 && currentStep < 6 && isFocused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isValid, currentStep, isFocused]);

  const handlePress = (e: any) => {
    if (!isFocused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('Dodaj');
      return;
    }

    if (currentStep === 0) {
      if (!isLoggedIn) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        navigation.navigate('Profil');
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress(e);
      }
    } else if (currentStep !== 6) {
      if (isValid) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('Dodaj', { screen: 'Step' + (currentStep + 1) });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Brakuje danych", errorMessage);
      }
    }
  };

  if (currentStep === 6 && isFocused) return <View style={{ width: 80 }} />;

  const isArrow = isFocused && currentStep > 0;
  const isReady = !isFocused || currentStep === 0 || isValid;

  return (
    <View style={{ top: -35, justifyContent: 'center', alignItems: 'center' }}>
      <Pressable onPress={handlePress}>
        <Animated.View style={{
          transform: [{ scale: pulseAnim }],
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: isReady ? Colors.primary : (isDark ? '#222' : '#e5e5e5'),
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Ionicons name={isArrow ? "arrow-forward" : "add"} size={40} color="#fff" />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const Tab = createBottomTabNavigator();

function MainTabs({ splashDone }: { splashDone: boolean }) {
  const restoreSession = useAuthStore(state => state.restoreSession);
  const systemColorScheme = useColorScheme();
  const themeMode = useThemeStore((state) => state.themeMode);

  useEffect(() => { restoreSession(); }, []);

  const resolvedTheme = themeMode === 'auto' ? (systemColorScheme ?? 'light') : themeMode;
  const currentColors = Colors[resolvedTheme];

  return (
    <Tab.Navigator screenOptions={{ 
      headerShown: false, 
      tabBarShowLabel: true, 
      tabBarActiveTintColor: Colors.primary, 
      tabBarInactiveTintColor: currentColors.subtitle, 
      tabBarStyle: { backgroundColor: resolvedTheme === 'dark' ? '#111' : '#ffffff', borderTopWidth: 0, height: 95, paddingBottom: 30, paddingTop: 10 } 
    }}>
      <Tab.Screen name="Radar" options={{ tabBarIcon: ({color}) => <Ionicons name="map" size={26} color={color} /> }}>
        {props => <RadarHomeScreen {...props} splashDone={splashDone} />}
      </Tab.Screen>
      <Tab.Screen
        name="Ulubione"
        initialParams={{ favoritesOnly: true }}
        options={{ tabBarIcon: ({ color }) => <Ionicons name="heart" size={24} color={color} /> }}
      >
        {props => <RadarHomeScreen {...props} splashDone={splashDone} />}
      </Tab.Screen>
      <Tab.Screen name="Dodaj" options={{ tabBarLabel: '', tabBarButton: (props) => <FloatingNextButton {...props} /> }}>
        {() => <AddOfferNavigator theme={currentColors} />}
      </Tab.Screen>
      <Tab.Screen
        name="Wiadomości"
        options={{ tabBarIcon: ({ color }) => <Ionicons name="chatbubble-ellipses" size={23} color={color} /> }}
      >
        {() => <DealroomListScreen />}
      </Tab.Screen>
      <Tab.Screen name="Profil" options={{ tabBarIcon: ({color}) => <Ionicons name="person-circle" size={28} color={color} /> }}>
        {() => <ProfileScreen theme={currentColors} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const AppStack = createNativeStackNavigator();

type PushNavigationTarget =
  | {
      screen: 'OfferDetail';
      params: { offer: { id: number | string } };
    }
  | {
      screen: 'DealroomChat';
      params: { dealId: number | string; offerId?: number | string; title?: string };
    };

const parseMaybeJson = (value: unknown): Record<string, any> => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const firstDefined = (...values: unknown[]) => values.find((v) => v !== undefined && v !== null && v !== '');

const parseNumericOrStringId = (value: unknown): number | string | null => {
  if (value === undefined || value === null) return null;
  const asString = String(value).trim();
  if (!asString) return null;
  const asNumber = Number(asString);
  return Number.isFinite(asNumber) ? asNumber : asString;
};

const parsePushTargetFromResponse = (
  response: Notifications.NotificationResponse | null
): PushNavigationTarget | null => {
  const baseData = parseMaybeJson(response?.notification?.request?.content?.data);
  const nestedData = {
    ...parseMaybeJson(baseData.payload),
    ...parseMaybeJson(baseData.data),
    ...parseMaybeJson(baseData.meta),
    ...parseMaybeJson(baseData.custom),
  };
  const data = { ...baseData, ...nestedData };

  const routeHint = String(
    firstDefined(
      data.target,
      data.type,
      data.action,
      data.screen,
      data.route,
      data.notificationType,
      data.entity
    ) || ''
  ).toLowerCase();

  const deeplink = String(firstDefined(data.deeplink, data.deepLink, data.link, data.url) || '');
  const deeplinkOfferMatch = deeplink.match(/offer\/(\d+)/i);
  const deeplinkDealMatch = deeplink.match(/deal(?:room)?\/(\d+)/i) || deeplink.match(/chat\/(\d+)/i);

  const offerId = parseNumericOrStringId(
    firstDefined(
      data.offerId,
      data.offer_id,
      data.listingId,
      data.propertyId,
      data?.offer?.id,
      deeplinkOfferMatch?.[1]
    )
  );

  const dealId = parseNumericOrStringId(
    firstDefined(
      data.dealId,
      data.deal_id,
      data.chatId,
      data.threadId,
      data.conversationId,
      data?.deal?.id,
      deeplinkDealMatch?.[1]
    )
  );

  const looksLikeOffer = routeHint.includes('offer') || routeHint.includes('oferta');
  const looksLikeDealOrChat =
    routeHint.includes('deal') || routeHint.includes('chat') || routeHint.includes('dealroom');

  if ((looksLikeOffer || (!!offerId && !looksLikeDealOrChat)) && offerId) {
    return {
      screen: 'OfferDetail',
      params: { offer: { id: offerId } },
    };
  }

  if ((looksLikeDealOrChat || !!dealId) && dealId) {
    const offerIdForDeal = parseNumericOrStringId(
      firstDefined(data.offerId, data.offer_id, data.listingId, data.propertyId, data?.offer?.id)
    );
    const title = String(firstDefined(data.title, data.dealTitle, data.chatTitle) || '').trim();
    return {
      screen: 'DealroomChat',
      params: {
        dealId,
        ...(offerIdForDeal ? { offerId: offerIdForDeal } : {}),
        ...(title ? { title } : {}),
      },
    };
  }

  return null;
};

export default function App() {
  const { token } = useAuthStore();
  const { askForPermission } = usePushNotifications(token);
  const systemColorScheme = useColorScheme();
  const [isSplashVisible, setSplashVisible] = useState(true);
  const themeMode = useThemeStore((state) => state.themeMode);
  const pendingPushTargetRef = useRef<PushNavigationTarget | null>(null);
  const handledResponseKeysRef = useRef<Record<string, number>>({});
  const lastNavigationKeyRef = useRef<{ key: string; at: number } | null>(null);

  const resolvedTheme = themeMode === 'auto' ? (systemColorScheme ?? 'light') : themeMode;

  const navigateFromPushTarget = useCallback((target: PushNavigationTarget | null) => {
    if (!target || !navigationRef.isReady()) return false;

    const navigationKey = `${target.screen}:${JSON.stringify(target.params)}`;
    const now = Date.now();
    if (
      lastNavigationKeyRef.current &&
      lastNavigationKeyRef.current.key === navigationKey &&
      now - lastNavigationKeyRef.current.at < 1800
    ) {
      return false;
    }

    lastNavigationKeyRef.current = { key: navigationKey, at: now };
    (navigationRef as any).navigate(target.screen, target.params);
    return true;
  }, []);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!response) return;

      const requestIdentifier = String(response.notification?.request?.identifier || '');
      const actionIdentifier = String(response.actionIdentifier || '');
      const dedupeKey = `${requestIdentifier}:${actionIdentifier}`;
      const now = Date.now();
      const handledAt = handledResponseKeysRef.current[dedupeKey];
      if (handledAt && now - handledAt < 10 * 60 * 1000) return;
      handledResponseKeysRef.current[dedupeKey] = now;

      const target = parsePushTargetFromResponse(response);
      if (!target) return;

      const navigated = navigateFromPushTarget(target);
      if (!navigated) {
        pendingPushTargetRef.current = target;
      }
    },
    [navigateFromPushTarget]
  );

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    void Notifications.getLastNotificationResponseAsync().then((lastResponse) => {
      handleNotificationResponse(lastResponse);
    });

    return () => sub.remove();
  }, [handleNotificationResponse]);

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {isSplashVisible && <AppleSplashScreen onFinish={() => setSplashVisible(false)} />}
        <NavigationContainer
          ref={navigationRef}
          theme={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}
          onReady={() => {
            if (!pendingPushTargetRef.current) return;
            const pendingTarget = pendingPushTargetRef.current;
            pendingPushTargetRef.current = null;
            navigateFromPushTarget(pendingTarget);
          }}
        >
          <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
          <AppStack.Navigator screenOptions={{ headerShown: false }}>
            <AppStack.Screen name="MainTabs">
              {() => <MainTabs splashDone={!isSplashVisible} />}
            </AppStack.Screen>
            <AppStack.Screen name="RadarLegacy">
              {(props) => <Radar {...props} theme={Colors[resolvedTheme]} />}
            </AppStack.Screen>
            <AppStack.Screen name="OfferDetail" component={OfferDetail} />
            <AppStack.Screen name="EditOffer" component={EditOfferScreen} />
            <AppStack.Screen name="Terms" component={TermsScreen} options={{ presentation: 'modal' }} />
            <AppStack.Screen name="SmsVerification" component={SmsVerificationScreen} options={{ presentation: 'modal' }} />
            <AppStack.Screen name="DealroomList" component={DealroomListScreen} />
            <AppStack.Screen name="DealroomChat" component={DealroomChatScreen} />
          </AppStack.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>

      {token && !isSplashVisible && (
        <PushOnboardingSheet onAccept={askForPermission} />
      )}
    </>
  );
}
