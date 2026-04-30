import * as Device from "expo-device";
import { usePushNotifications } from "./src/hooks/usePushNotifications";
import PushOnboardingSheet from "./src/components/PushOnboardingSheet";
import DealroomChatScreen from './src/screens/DealroomChatScreen';
import AppleSplashScreen from "./src/components/AppleSplashScreen";
import OfferDetail from './src/screens/OfferDetail';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Pressable, Animated, Alert, useColorScheme, ScrollView, PanResponder } from 'react-native';

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
import EstateDiscoveryMode from './src/screens/EstateDiscoveryMode';

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
  const holdScale = useRef(new Animated.Value(1)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuProgress = useRef(new Animated.Value(0)).current;
  const themeMode = useThemeStore(s => s.themeMode);
  const isDark = themeMode === 'dark';
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

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

  const quickActions = [
    {
      key: 'MINE',
      label: 'Moje',
      icon: 'home',
      angleDeg: 200,
      distance: 88,
      tint: '#10B981',
      glassBg: isDark ? 'rgba(16,185,129,0.28)' : 'rgba(16,185,129,0.2)',
      target: () => navigation.navigate('Ulubione', { favoritesOnly: true, favoritesScope: 'MINE' }),
    },
    {
      key: 'DISCOVERY',
      label: 'Discovery',
      icon: 'sparkles',
      angleDeg: 270,
      distance: 104,
      tint: '#D4AF37',
      glassBg: isDark ? 'rgba(212,175,55,0.28)' : 'rgba(212,175,55,0.2)',
      target: () => navigation.navigate('EstateDiscovery'),
    },
    {
      key: 'FAVORITES',
      label: 'Ulubione',
      icon: 'heart',
      angleDeg: 340,
      distance: 88,
      tint: '#F777B2',
      glassBg: isDark ? 'rgba(247,119,178,0.28)' : 'rgba(247,119,178,0.2)',
      target: () => navigation.navigate('Ulubione', { favoritesOnly: true, favoritesScope: 'FAVORITES' }),
    },
  ] as const;
  const SNAP_DISTANCE = 40;
  const CASCADE_STEP = 0.14;

  const clearLongPressTimer = useCallback(() => {
    if (!longPressTimeoutRef.current) return;
    clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = null;
  }, []);

  const openQuickMenu = useCallback(() => {
    setIsQuickMenuOpen(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.parallel([
      Animated.spring(holdScale, { toValue: 1.08, friction: 6, tension: 120, useNativeDriver: true }),
      Animated.timing(menuOpacity, { toValue: 1, duration: 170, useNativeDriver: true }),
      Animated.timing(menuProgress, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [holdScale, menuOpacity, menuProgress]);

  const closeQuickMenu = useCallback((toScale = 1) => {
    Animated.parallel([
      Animated.spring(holdScale, { toValue: toScale, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.timing(menuOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(menuProgress, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setIsQuickMenuOpen(false);
      setHoveredAction(null);
    });
  }, [holdScale, menuOpacity, menuProgress]);

  const resolveHoveredAction = useCallback((dx: number, dy: number) => {
    if (!isQuickMenuOpen) return null;

    const distanceFromCenter = Math.hypot(dx, dy);
    if (distanceFromCenter < 30) return null; // martwa strefa

    let best: { key: string; dist: number } | null = null;
    for (const item of quickActions) {
      const rad = (item.angleDeg * Math.PI) / 180;
      const tx = Math.cos(rad) * item.distance;
      const ty = Math.sin(rad) * item.distance;
      const dist = Math.hypot(dx - tx, dy - ty);
      if (!best || dist < best.dist) {
        best = { key: item.key, dist };
      }
    }

    if (!best || best.dist > 60) return null;
    if (best.dist < SNAP_DISTANCE) return best.key;

    return best.key;
  }, [isQuickMenuOpen]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        clearLongPressTimer();
        setHoveredAction(null);
        longPressTimeoutRef.current = setTimeout(() => {
          openQuickMenu();
        }, 700);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isQuickMenuOpen) {
          // Apple-like: jeśli palec od razu jedzie, nie traktujemy tego jak long press.
          if (Math.hypot(gestureState.dx, gestureState.dy) > 12) clearLongPressTimer();
          return;
        }
        const hovered = resolveHoveredAction(gestureState.dx, gestureState.dy);
        setHoveredAction((prev) => {
          if (prev === hovered) return prev;
          if (hovered) void Haptics.selectionAsync();
          return hovered;
        });
      },
      onPanResponderRelease: (e, gestureState) => {
        clearLongPressTimer();

        if (!isQuickMenuOpen) {
          closeQuickMenu(1);
          handlePress(e);
          return;
        }

        const selected = resolveHoveredAction(gestureState.dx, gestureState.dy);

        if (selected) {
          const target = quickActions.find((q) => q.key === selected);

          closeQuickMenu(1);

          requestAnimationFrame(() => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            target?.target();
          });

          return;
        }

        closeQuickMenu(1);
      },
      onPanResponderTerminate: (_, gestureState) => {
        clearLongPressTimer();
        if (!isQuickMenuOpen) {
          closeQuickMenu(1);
          return;
        }
        const selected = resolveHoveredAction(gestureState.dx, gestureState.dy);
        if (selected) {
          const target = quickActions.find((q) => q.key === selected);
          closeQuickMenu(1);
          requestAnimationFrame(() => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            target?.target();
          });
          return;
        }
        closeQuickMenu(1);
      },
      onPanResponderTerminationRequest: () => false,
    }),
    [clearLongPressTimer, isQuickMenuOpen, closeQuickMenu, handlePress, openQuickMenu, resolveHoveredAction]
  );

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  if (currentStep === 6 && isFocused) return <View style={{ width: 80 }} />;

  const isArrow = isFocused && currentStep > 0;
  const isReady = !isFocused || currentStep === 0 || isValid;

  return (
    <View style={{ top: -35, justifyContent: 'center', alignItems: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: 108,
          height: 108,
          borderRadius: 54,
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.76)',
          borderWidth: 1.5,
          borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.92)',
          shadowColor: '#FFFFFF',
          shadowOpacity: isDark ? 0.08 : 0.38,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -2 },
          elevation: 4,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 98,
          height: 98,
          borderRadius: 49,
          backgroundColor: isDark ? 'rgba(0,0,0,0.32)' : 'rgba(180,190,200,0.18)',
          shadowColor: '#000',
          shadowOpacity: 0.22,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 7 },
          elevation: 6,
        }}
      />
      <View {...panResponder.panHandlers}>
        <Animated.View style={{
          transform: [{ scale: Animated.multiply(pulseAnim, holdScale) }],
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: isReady ? Colors.primary : (isDark ? '#222' : '#e5e5e5'),
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Ionicons name={isArrow ? "arrow-forward" : "add"} size={40} color="#fff" />
        </Animated.View>
      </View>
      {isQuickMenuOpen && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            width: 280,
            height: 280,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: menuOpacity,
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 168,
              height: 168,
              borderRadius: 84,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.46)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
              transform: [
                {
                  scale: menuProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.78, 1],
                  }),
                },
              ],
              opacity: menuProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            }}
          />
          {quickActions.map((item, index) => {
            const rad = (item.angleDeg * Math.PI) / 180;
            const tx = Math.cos(rad) * item.distance;
            const ty = Math.sin(rad) * item.distance;
            const isHovered = hoveredAction === item.key;
            const start = index * CASCADE_STEP;
            const end = Math.min(1, start + 0.48);
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  const target = item.target;
                  closeQuickMenu(1);
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  target();
                }}
                style={{ position: 'absolute' }}
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        translateX: menuProgress.interpolate({
                          inputRange: [0, start, end, 1],
                          outputRange: [0, 0, tx * 0.92, tx],
                        }),
                      },
                      {
                        translateY: menuProgress.interpolate({
                          inputRange: [0, start, end, 1],
                          outputRange: [0, 0, ty * 0.92, ty],
                        }),
                      },
                      {
                        scale: menuProgress.interpolate({
                          inputRange: [0, start, end, 1],
                          outputRange: [0.64, 0.64, isHovered ? 1.14 : 1.02, isHovered ? 1.12 : 1],
                        }),
                      },
                    ],
                    opacity: menuProgress.interpolate({
                      inputRange: [0, start, end, 1],
                      outputRange: [0, 0, 0.92, 1],
                    }),
                  }}
                >
                  <View
                    style={{
                      minWidth: 90,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 18,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: isHovered
                        ? item.glassBg
                        : (isDark ? 'rgba(22,22,24,0.68)' : 'rgba(255,255,255,0.72)'),
                      borderWidth: 1,
                      borderColor: isHovered ? item.tint : (isDark ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.7)'),
                      shadowColor: '#000',
                      shadowOpacity: isHovered ? 0.22 : 0.12,
                      shadowRadius: isHovered ? 14 : 8,
                      shadowOffset: { width: 0, height: 6 },
                    }}
                  >
                    <Ionicons name={item.icon as any} size={13} color={isHovered ? item.tint : (isDark ? '#FFF' : '#1C1C1E')} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: isHovered ? item.tint : (isDark ? '#FFF' : '#1C1C1E') }}>{item.label}</Text>
                  </View>
                </Animated.View>
              </Pressable>
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}

const Tab = createBottomTabNavigator();

function MainTabs({ splashDone }: { splashDone: boolean }) {
  const restoreSession = useAuthStore(state => state.restoreSession);
  const token = useAuthStore((state: any) => state.token);
  const systemColorScheme = useColorScheme();
  const themeMode = useThemeStore((state) => state.themeMode);
  const [hasUnreadDeals, setHasUnreadDeals] = useState(false);

  useEffect(() => { restoreSession(); }, []);

  useEffect(() => {
    let mounted = true;
    const fetchUnread = async () => {
      if (!token) {
        if (mounted) setHasUnreadDeals(false);
        return;
      }
      try {
        const res = await fetch('https://estateos.pl/api/mobile/v1/deals', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const deals = Array.isArray(json)
          ? json
          : Array.isArray(json?.deals)
            ? json.deals
            : Array.isArray(json?.items)
              ? json.items
              : [];
        const unread = deals.some((deal: any) => Number(deal?.unread || 0) > 0);
        if (mounted) setHasUnreadDeals(unread);
      } catch {
        // noop
      }
    };
    fetchUnread();
    const t = setInterval(fetchUnread, 12000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [token]);

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
        options={{
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="chatbubble-ellipses" size={23} color={color} />
              {hasUnreadDeals ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -4,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: '#FF3B30',
                    borderWidth: 1.5,
                    borderColor: '#FFFFFF',
                  }}
                />
              ) : null}
            </View>
          ),
        }}
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

const extractIdFromDeeplink = (deeplink: string, kind: 'offer' | 'deal') => {
  if (!deeplink) return null;
  const cleaned = deeplink.trim();
  if (!cleaned) return null;

  const pathRegexes =
    kind === 'offer'
      ? [/offers?\/(\d+)/i, /oferta\/(\d+)/i, /listing\/(\d+)/i, /property\/(\d+)/i]
      : [/deals?\/(\d+)/i, /dealroom\/(\d+)/i, /chat\/(\d+)/i, /thread\/(\d+)/i, /conversation\/(\d+)/i];

  for (const rx of pathRegexes) {
    const m = cleaned.match(rx);
    if (m?.[1]) return m[1];
  }

  try {
    const normalized = cleaned.includes('://') ? cleaned : `https://estateos.pl/${cleaned.replace(/^\//, '')}`;
    const u = new URL(normalized);
    if (kind === 'offer') {
      return (
        u.searchParams.get('offerId') ||
        u.searchParams.get('offer_id') ||
        u.searchParams.get('listingId') ||
        u.searchParams.get('propertyId') ||
        u.searchParams.get('id')
      );
    }
    return (
      u.searchParams.get('dealId') ||
      u.searchParams.get('deal_id') ||
      u.searchParams.get('chatId') ||
      u.searchParams.get('threadId') ||
      u.searchParams.get('conversationId') ||
      u.searchParams.get('id')
    );
  } catch {
    return null;
  }
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
  const deeplinkOfferId = extractIdFromDeeplink(deeplink, 'offer');
  const deeplinkDealId = extractIdFromDeeplink(deeplink, 'deal');

  const offerId = parseNumericOrStringId(
    firstDefined(
      data.offerId,
      data.offer_id,
      data.listingId,
      data.propertyId,
      data?.offer?.id,
      deeplinkOfferId
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
      deeplinkDealId
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
            <AppStack.Screen name="EstateDiscovery" component={EstateDiscoveryMode} />
          </AppStack.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>

      {token && !isSplashVisible && (
        <PushOnboardingSheet onAccept={askForPermission} />
      )}
    </>
  );
}
