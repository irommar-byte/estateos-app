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
import { StyleSheet, Text, View, Pressable, Animated, Alert, useColorScheme, ScrollView, PanResponder, Linking } from 'react-native';

import * as Notifications from "expo-notifications";

Notifications.addNotificationReceivedListener(notification => {
  console.log("📩 FULL NOTIFICATION:", JSON.stringify(notification, null, 2));
});

import { createNavigationContainerRef } from "@react-navigation/native";

import { NavigationContainer, DarkTheme, DefaultTheme, StackActions, useNavigation, useNavigationState } from '@react-navigation/native';
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
import { extractIdFromDeeplink } from './src/utils/deeplinkParse';
import {
  extractPushDealAndOfferIds,
  firstDefined,
  mergePushPayload,
  shouldPrioritizeDealroom,
} from './src/contracts/parityContracts';

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

/** Aktywny ekran AddOffer (Step1…Step6) ze stanu tabów — po restarcie Zustand ma currentStep=0, ale stack jest przywrócony. */
function parseAddOfferStepFromTabNavState(navState: any): number | null {
  try {
    const routes = navState?.routes;
    if (!Array.isArray(routes)) return null;
    const dodaj = routes.find((r: any) => r?.name === 'Dodaj');
    const stack = dodaj?.state;
    if (!stack?.routes?.length) return null;
    const idx = typeof stack.index === 'number' ? stack.index : stack.routes.length - 1;
    const name = stack.routes[idx]?.name;
    if (typeof name === 'string' && /^Step\d+$/i.test(name)) {
      const n = parseInt(name.replace(/^Step/i, ''), 10);
      return Number.isFinite(n) ? n : null;
    }
  } catch {
    /* noop */
  }
  return null;
}

// ======================================================================
// KASKADOWY PLUSIK (APPLE GLASS) - ZABEZPIECZONY PANRESPONDER I KĄTY
// ======================================================================
const FloatingNextButton = ({ onPress }: any) => {
  const draft = useOfferStore((s) => s.draft);
  const currentStep = useOfferStore((s) => s.currentStep);
  const setCurrentStep = useOfferStore((s) => s.setCurrentStep);
  const stepFromNav = useNavigationState(parseAddOfferStepFromTabNavState);
  const step = stepFromNav ?? currentStep;

  useEffect(() => {
    if (stepFromNav != null && stepFromNav !== currentStep) {
      setCurrentStep(stepFromNav);
    }
  }, [stepFromNav, currentStep, setCurrentStep]);

  const user = useAuthStore(state => state.user); 
  const isLoggedIn = !!user;
  const navigation = useNavigation<any>();
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const holdScale = useRef(new Animated.Value(1)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuProgress = useRef(new Animated.Value(0)).current;
  const itemScales = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;
  
  const themeMode = useThemeStore(s => s.themeMode);
  const isDark = themeMode === 'dark';
  
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<View | null>(null);
  const buttonLayoutRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const initialDirectionRef = useRef<"VERTICAL" | "HORIZONTAL" | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const activeRouteName = useNavigationState(state => state?.routes[state.index]?.name || 'Radar');
  const isFocused = activeRouteName === 'Dodaj';

  let isValid = false;
  let errorMessage = getStepBlockMessage(step);
  if (step >= 1 && step <= 5) {
    isValid = isStepValid(step, draft);
    errorMessage = getStepBlockMessage(step);
  }

  useEffect(() => {
    if (isValid && step > 0 && step < 6 && isFocused) {
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
  }, [isValid, step, isFocused]);

  const handlePress = (e: any) => {
    if (!isFocused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('Dodaj');
      return;
    }

    if (step === 0) {
      if (!isLoggedIn) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        navigation.navigate('Profil');
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress(e);
      }
    } else if (step !== 6) {
      if (isValid) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('Dodaj', { screen: 'Step' + (step + 1) });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Brakuje danych", errorMessage);
      }
    }
  };

  // Ustawione kąty: 180 (lewo), 270 (góra), 0 (prawo)
  const quickActions = [
    {
      key: 'MINE',
      label: 'Moje',
      icon: 'home',
      angleDeg: 180,
      distance: 90,
      tint: '#10B981',
      glassBg: isDark ? 'rgba(16,185,129,0.28)' : 'rgba(16,185,129,0.2)',
      target: () => navigation.navigate('Ulubione', { favoritesOnly: true, favoritesScope: 'MINE' }),
    },
    {
      key: 'DISCOVERY',
      label: 'Discovery',
      icon: 'sparkles',
      angleDeg: 270,
      distance: 105,
      tint: '#D4AF37',
      glassBg: isDark ? 'rgba(212,175,55,0.28)' : 'rgba(212,175,55,0.2)',
      target: () => navigation.navigate('EstateDiscovery'),
    },
    {
      key: 'FAVORITES',
      label: 'Ulubione',
      icon: 'heart',
      angleDeg: 0,
      distance: 130,
      tint: '#F777B2',
      glassBg: isDark ? 'rgba(247,119,178,0.28)' : 'rgba(247,119,178,0.2)',
      target: () => navigation.navigate('Ulubione', { favoritesOnly: true, favoritesScope: 'FAVORITES' }),
    },
  ] as const;

  const clearLongPressTimer = useCallback(() => {
    if (!longPressTimeoutRef.current) return;
    clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = null;
  }, []);

  const openQuickMenu = useCallback(() => {
    console.log("[PLUS] openQuickMenu");
    setIsQuickMenuOpen(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    quickActions.forEach((_, i) => itemScales[i].setValue(1));
    
    Animated.parallel([
      Animated.spring(holdScale, { toValue: 1.08, friction: 6, tension: 120, useNativeDriver: true }),
      Animated.timing(menuOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.spring(menuProgress, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [holdScale, menuOpacity, menuProgress, itemScales, quickActions]);

  const closeQuickMenu = useCallback((toScale = 1) => {
    Animated.parallel([
      Animated.spring(holdScale, { toValue: toScale, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.timing(menuOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(menuProgress, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setIsQuickMenuOpen(false);
      setHoveredAction(null);
        initialDirectionRef.current = null;
    });
  }, [holdScale, menuOpacity, menuProgress]);
  const resolveHoveredAction = useCallback((dx: number, dy: number) => {
    if (!isQuickMenuOpen) return null;

    const r = Math.hypot(dx, dy);
    if (r < 30) return null;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    let best: { key: string; diff: number } | null = null;

    for (const item of quickActions) {
      const target = item.angleDeg;
      let diff = Math.abs(angle - target);
      if (diff > 180) diff = 360 - diff;

      if (!best || diff < best.diff) {
        best = { key: item.key, diff };
      }
    }

    if (!best) return null;
    const limit = best.key === "FAVORITES" ? 8 : 35;
    if (best.diff > limit) return null;

    return best.key;
  }, [isQuickMenuOpen, quickActions]);


  const onReleaseGesture = useCallback((dx: number, dy: number, e: any) => {
    clearLongPressTimer();
    if (!isQuickMenuOpen) {
      closeQuickMenu(1);
      handlePress(e);
      return;
    }

    console.log("[PLUS] release", { dx, dy, button: buttonLayoutRef.current });
    const selected = resolveHoveredAction(dx, dy);
    console.log("[PLUS] selected", selected);
    if (selected) {
      const target = quickActions.find((q) => q.key === selected);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeQuickMenu(1);
      target?.target();
      return;
    }
    closeQuickMenu(1);
  }, [clearLongPressTimer, isQuickMenuOpen, closeQuickMenu, handlePress, resolveHoveredAction, quickActions]);

  // PAN RESPONDER - ZABEZPIECZENIE PRZED KRADZIEŻĄ GESTU
  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true, // Zatrzymuje Map/ScrollView przed przejęciem dotyku
      onPanResponderGrant: () => {
        console.log("[PLUS] grant");
        clearLongPressTimer();
        setHoveredAction(null);
        initialDirectionRef.current = null;
        longPressTimeoutRef.current = setTimeout(() => {
          openQuickMenu();
        }, 700);
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isQuickMenuOpen) return;
        
        let dx = gestureState.moveX - buttonLayoutRef.current.x;
        let dy = gestureState.moveY - buttonLayoutRef.current.y;

        if (!initialDirectionRef.current) {
          if (Math.abs(dy) > Math.abs(dx) * 0.6) initialDirectionRef.current = "VERTICAL";
          else initialDirectionRef.current = "HORIZONTAL";
        }

        if (initialDirectionRef.current === "VERTICAL") dx = 0;
        if (initialDirectionRef.current === "HORIZONTAL") dy = 0;

        const hovered = resolveHoveredAction(gestureState.moveX - buttonLayoutRef.current.x , gestureState.moveY - buttonLayoutRef.current.y );
        console.log("[PLUS] move", { moveX: gestureState.moveX, moveY: gestureState.moveY, button: buttonLayoutRef.current, hovered });
        setHoveredAction((prev) => {
          if (prev === hovered) return prev;
          if (hovered) void Haptics.selectionAsync();

          // Płynne skalowanie elementów kaskadowych (bez uciekania)
          quickActions.forEach((qa, idx) => {
            Animated.spring(itemScales[idx], {
              toValue: qa.key === hovered ? 1.25 : 1,
              friction: 5,
              useNativeDriver: true
            }).start();
          });

          return hovered;
        });
      },
      onPanResponderRelease: (e, gestureState) => {
        onReleaseGesture(gestureState.moveX - buttonLayoutRef.current.x , gestureState.moveY - buttonLayoutRef.current.y , e);
      },
      onPanResponderTerminate: (_, gestureState) => {
        onReleaseGesture(gestureState.moveX - buttonLayoutRef.current.x , gestureState.moveY - buttonLayoutRef.current.y , null);
      },
      onPanResponderTerminationRequest: () => false,
    }),
    [clearLongPressTimer, isQuickMenuOpen, onReleaseGesture, openQuickMenu, resolveHoveredAction, itemScales, quickActions]
  );

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  if (step === 6 && isFocused) return <View style={{ width: 80 }} />;

  const isArrow = isFocused && step > 0;
  const isReady = !isFocused || step === 0 || isValid;

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
      <View ref={buttonRef} collapsable={false} {...panResponder.panHandlers} onLayout={() => { requestAnimationFrame(() => { buttonRef.current?.measureInWindow((x, y, w, h) => { buttonLayoutRef.current = { x: x + w/2, y: y + h/2 }; console.log("[PLUS] measureInWindow", { x, y, w, h, centerX: x + w/2, centerY: y + h/2 }); }); }); }}>
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
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 300,
            height: 300,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: menuOpacity,
            zIndex: 999
          }}
        >
          {quickActions.map((item, index) => {
            const rad = (item.angleDeg * Math.PI) / 180;
            const tx = Math.cos(rad) * item.distance;
            const ty = Math.sin(rad) * item.distance;
            const isHovered = hoveredAction === item.key;
            return (
              <Animated.View
                key={item.key}
                style={{
                  position: 'absolute',
                  transform: [
                    {
                      translateX: menuProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, tx],
                      }),
                    },
                    {
                      translateY: menuProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, ty],
                      }),
                    },
                    {
                      scale: Animated.multiply(
                        menuProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1],
                        }),
                        itemScales[index]
                      ),
                    },
                  ],
                  opacity: menuProgress,
                }}
              >
                <View
                  style={{
                    minWidth: 84,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: isHovered
                      ? item.glassBg
                      : (isDark ? 'rgba(22,22,24,0.85)' : 'rgba(255,255,255,0.92)'),
                    borderWidth: 1.5,
                    borderColor: isHovered ? item.tint : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                    shadowColor: '#000',
                    shadowOpacity: isHovered ? 0.3 : 0.12,
                    shadowRadius: isHovered ? 14 : 8,
                    shadowOffset: { width: 0, height: 6 },
                  }}
                >
                  <Ionicons name={item.icon as any} size={15} color={isHovered ? item.tint : (isDark ? '#FFF' : '#1C1C1E')} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: isHovered ? item.tint : (isDark ? '#FFF' : '#1C1C1E') }}>{item.label}</Text>
                </View>
              </Animated.View>
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
        initialParams={{ favoritesOnly: true, favoritesScope: 'FAVORITES' }}
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
      params: { offer: { id: number | string }; id: number | string; offerId: number | string };
    }
  | {
      screen: 'DealroomChat';
      params: { dealId: number | string; offerId?: number | string; title?: string };
    }
  | {
      screen: 'MainTabs';
      params: { screen: 'Radar' | 'Ulubione' | 'Wiadomości' };
    };

const parseNumericOrStringId = (value: unknown): number | string | null => {
  if (value === undefined || value === null) return null;
  const asString = String(value).trim();
  if (!asString) return null;
  const asNumber = Number(asString);
  return Number.isFinite(asNumber) ? asNumber : asString;
};

const parseLinkToPushTarget = (url: string): PushNavigationTarget | null => {
  const offerIdStr = extractIdFromDeeplink(url, 'offer');
  const id = parseNumericOrStringId(offerIdStr);
  if (id) {
    return {
      screen: 'OfferDetail',
      params: { offer: { id }, id, offerId: id },
    };
  }
  return null;
};

const parsePushTargetFromResponse = (
  response: Notifications.NotificationResponse | null
): PushNavigationTarget | null => {
  const data = mergePushPayload({
    baseData: response?.notification?.request?.content?.data,
    triggerPayload: (response as any)?.notification?.request?.trigger?.payload,
  });
  const targetTypeNorm = String(firstDefined(data.targetType, data.entity, data.notificationType) || '')
    .trim()
    .toUpperCase();
  const targetTypeLooksOffer =
    targetTypeNorm.includes('OFFER') ||
    targetTypeNorm.includes('LISTING') ||
    targetTypeNorm.includes('PROPERTY') ||
    targetTypeNorm.includes('RADAR');
  const targetTypeLooksDeal =
    targetTypeNorm.includes('DEAL') ||
    targetTypeNorm.includes('CHAT') ||
    targetTypeNorm.includes('THREAD') ||
    targetTypeNorm.includes('CONVERSATION');

  const routeHint = String(
    firstDefined(
      data.target,
      data.targetType,
      data.type,
      data.action,
      data.screen,
      data.route,
      data.notificationType,
      data.entity
    ) || ''
  ).toLowerCase();

  const deeplink = String(firstDefined(data.deeplink, data.deepLink, data.link, data.url, data.dealroomLink) || '');
  const deeplinkLower = deeplink.toLowerCase();
  const deeplinkOfferId = extractIdFromDeeplink(deeplink, 'offer');
  const deeplinkDealId = extractIdFromDeeplink(deeplink, 'deal');

  const extractedIds = extractPushDealAndOfferIds(data);
  const offerId = parseNumericOrStringId(extractedIds.offerId ?? deeplinkOfferId);
  const dealId = parseNumericOrStringId(extractedIds.dealId ?? deeplinkDealId);

  const looksLikeOffer = routeHint.includes('offer') || routeHint.includes('oferta');
  const looksLikeDealOrChat =
    routeHint.includes('deal') || routeHint.includes('chat') || routeHint.includes('dealroom');
  const looksLikeRadar =
    routeHint.includes('radar') ||
    routeHint.includes('match') ||
    routeHint.includes('favorite') ||
    routeHint.includes('favourite') ||
    routeHint.includes('ulub');
  const deeplinkLooksLikeDeal = /(deal|dealroom|chat|conversation|thread)/i.test(deeplinkLower);
  const deeplinkLooksLikeOffer = /(offer|oferta|listing|property|\/o\/)/i.test(deeplinkLower);
  const deeplinkLooksLikeRadar = /(radar|favorite|favourite|ulub)/i.test(deeplinkLower);
  const explicitOfferTarget =
    ['offer', 'oferta', 'listing', 'property', 'radar', 'radar_match', 'offer_push', 'offer_update', 'offer_match'].includes(routeHint) ||
    routeHint.startsWith('offer_') ||
    routeHint.startsWith('listing_') ||
    routeHint.startsWith('property_') ||
    routeHint.startsWith('radar_') ||
    targetTypeLooksOffer;
  const explicitDealTarget =
    ['dealroom', 'dealroom_chat', 'deal', 'chat', 'message', 'deal_chat'].includes(routeHint) ||
    routeHint.startsWith('deal_') ||
    routeHint.startsWith('chat_') ||
    targetTypeLooksDeal;
  const prioritizeDealroom = shouldPrioritizeDealroom(data, extractedIds.dealId);
  const textHint = `${String(response?.notification?.request?.content?.title || '')} ${String(
    response?.notification?.request?.content?.body || ''
  )}`.toLowerCase();
  const offerSemanticHint =
    /(ofert|offer|listing|nieruchomo|radar|aktywac|opublikow|dopasowan)/i.test(textHint) ||
    /(offer|listing|property|oferta|radar|match)/i.test(String(data.notificationType || '').toLowerCase());

  // 0) Priorytet backend dealroom: target='dealroom' / targetType='DEAL' / dealId.
  if (prioritizeDealroom && dealId) {
    const offerIdForDeal = parseNumericOrStringId(
      firstDefined(
        data.offerId,
        data.offer_id,
        data.listingId,
        data.propertyId,
        data.property_id,
        data?.offer?.id
      )
    );
    const title = String(firstDefined(data.title, data.dealTitle, data.chatTitle, data.subject) || '').trim();
    return {
      screen: 'DealroomChat',
      params: {
        dealId,
        ...(offerIdForDeal ? { offerId: offerIdForDeal } : {}),
        ...(title ? { title } : {}),
      },
    };
  }

  // 1) Deeplink ma wysoki priorytet (kompatybilność wsteczna).
  if (deeplinkDealId) {
    const id = parseNumericOrStringId(deeplinkDealId);
    if (id) {
      const offerIdForDeal = parseNumericOrStringId(
        firstDefined(
          data.offerId,
          data.offer_id,
          data.listingId,
          data.propertyId,
          data.property_id,
          data?.offer?.id
        )
      );
      const title = String(firstDefined(data.title, data.dealTitle, data.chatTitle, data.subject) || '').trim();
      return {
        screen: 'DealroomChat',
        params: {
          dealId: id,
          ...(offerIdForDeal ? { offerId: offerIdForDeal } : {}),
          ...(title ? { title } : {}),
        },
      };
    }
  }
  if (deeplinkOfferId) {
    const id = parseNumericOrStringId(deeplinkOfferId);
    if (id) {
      return {
        screen: 'OfferDetail',
        params: { offer: { id }, id, offerId: id },
      };
    }
  }

  // 2) Fallback ofertowy po offerId (nowy kontrakt: dopiero po dealroom).
  if ((explicitOfferTarget || (offerId && (deeplinkLooksLikeOffer || offerSemanticHint || looksLikeOffer || looksLikeRadar))) && offerId) {
    return {
      screen: 'OfferDetail',
      params: { offer: { id: offerId }, id: offerId, offerId },
    };
  }

  // 3) Jawny target dealroom/czat (stare payloady bez target='dealroom').
  if (
    (explicitDealTarget || looksLikeDealOrChat || deeplinkLooksLikeDeal || !!dealId) &&
    dealId &&
    !deeplinkLooksLikeOffer &&
    !offerSemanticHint
  ) {
    const offerIdForDeal = parseNumericOrStringId(
      firstDefined(
        data.offerId,
        data.offer_id,
        data.listingId,
        data.propertyId,
        data.property_id,
        data?.offer?.id
      )
    );
    const title = String(firstDefined(data.title, data.dealTitle, data.chatTitle, data.subject) || '').trim();
    return {
      screen: 'DealroomChat',
      params: {
        dealId,
        ...(offerIdForDeal ? { offerId: offerIdForDeal } : {}),
        ...(title ? { title } : {}),
      },
    };
  }

  // 4) Powiadomienia ofertowe / radarowe z offerId
  if ((looksLikeOffer || looksLikeRadar || deeplinkLooksLikeOffer || deeplinkLooksLikeRadar || !!offerId) && offerId) {
    return {
      screen: 'OfferDetail',
      params: { offer: { id: offerId }, id: offerId, offerId },
    };
  }

  // 5) Fallback po deeplinku bez id (np. "estateos://dealroom")
  if (looksLikeDealOrChat || deeplinkLooksLikeDeal) {
    return {
      screen: 'MainTabs',
      params: { screen: 'Wiadomości' },
    };
  }

  // 6) Fallback radar bez offerId
  if (looksLikeRadar || deeplinkLooksLikeRadar || deeplinkLower.includes('://radar')) {
    return {
      screen: 'MainTabs',
      params: { screen: 'Radar' },
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
    console.log('[PUSH][NAVIGATE]', navigationKey);
    if (target.screen === 'OfferDetail' || target.screen === 'DealroomChat') {
      (navigationRef as any).dispatch(StackActions.push(target.screen, target.params));
    } else {
      (navigationRef as any).navigate(target.screen, target.params);
    }
    return true;
  }, []);

  const handleIncomingLink = useCallback(
    (url: string | null) => {
      if (!url) return;
      const target = parseLinkToPushTarget(url);
      if (!target) return;
      const navigated = navigateFromPushTarget(target);
      if (!navigated) {
        pendingPushTargetRef.current = target;
      }
    },
    [navigateFromPushTarget]
  );

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
      console.log(
        '[PUSH][RESPONSE]',
        JSON.stringify({
          dedupeKey,
          requestIdentifier,
          actionIdentifier,
          target,
          data: response.notification?.request?.content?.data || {},
        })
      );
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

  useEffect(() => {
    if (isSplashVisible) return;

    let alive = true;
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (alive) handleIncomingLink(url);
    });

    void Linking.getInitialURL().then((url) => {
      if (alive && url) handleIncomingLink(url);
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, [isSplashVisible, handleIncomingLink]);

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
