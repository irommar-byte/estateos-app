import * as Device from "expo-device";
import { usePushNotifications } from './src/hooks/usePushNotifications';
import PushOnboardingSheet from "./src/components/PushOnboardingSheet";
import DealroomChatScreen from './src/screens/DealroomChatScreen';
import AppleSplashScreen from "./src/components/AppleSplashScreen";
import OfferDetail from './src/screens/OfferDetail';
import CircularLabelRing from './src/components/CircularLabelRing';
import { IAPManager } from './src/services/iapManager';
import { API_URL } from './src/config/network';
import { stopRadarLiveActivity } from './src/services/radarLiveActivityService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Pressable, Animated, Alert, useColorScheme, ScrollView, PanResponder, Linking, AppState } from 'react-native';

import * as Notifications from "expo-notifications";

import { createNavigationContainerRef } from "@react-navigation/native";

import { NavigationContainer, DarkTheme, DefaultTheme, StackActions, useNavigation, useNavigationState } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useThemeStore, ThemeMode } from './src/store/useThemeStore';
import { useOfferStore } from './src/store/useOfferStore';
import { useAuthStore } from './src/store/useAuthStore';
import { useBlockedUsersStore } from './src/store/useBlockedUsersStore';
import { useUnreadBadgeStore } from './src/store/useUnreadBadgeStore';
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

if (__DEV__) {
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('[push] received (dev):', notification.request?.content?.title ?? '');
  });
}

const navigationRef = createNavigationContainerRef();

const AddOfferStack = createNativeStackNavigator();
function AddOfferNavigator({ theme }: { theme: any }) {
  return (
    <AddOfferStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 320,
        /** Wyłączone globalnie: edge-swipe i „pełny ekran” kolidują z przewijaniem i gestami w formularzach (np. galeria). */
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
      }}
    >
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
  // Crossfade między napisami „DODAJ OFERTĘ" i „DALEJ". Każdy napis to
  // OSOBNY, stale-zamontowany CircularLabelRing z FIXED propsami — przy
  // przełączaniu tylko opacity migra od 0 do 1. Dzięki temu SVG NIGDY się
  // nie remountuje, łuk nie skacze pozycyjnie i nie ma „migotania" znanego
  // wcześniej przy zmianie isArrow.
  const plusLabelOpacity = useRef(new Animated.Value(1)).current;
  const arrowLabelOpacity = useRef(new Animated.Value(0)).current;
  
  const themeMode = useThemeStore(s => s.themeMode);
  const setThemeMode = useThemeStore((s) => s.setThemeMode);
  const resolvedDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
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

  // CROSSFADE NAPISÓW — przełączamy się PŁYNNIE między „DODAJ OFERTĘ"
  // a „DALEJ" tylko przez zmianę opacity (oba SVG zawsze są zamontowane,
  // pozycje i geometria stałe). Dzięki temu napis nie skacze pomiędzy
  // ekranami i nie ma efektu „znika i pojawia się".
  const isArrowForLabel = isFocused && step > 0;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(plusLabelOpacity, {
        toValue: isArrowForLabel ? 0 : 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(arrowLabelOpacity, {
        toValue: isArrowForLabel ? 1 : 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isArrowForLabel, plusLabelOpacity, arrowLabelOpacity]);

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
        // GATE: bieżący krok może chcieć przejąć kontrolę (np. Step 2 pokazuje
        // modal potwierdzenia adresu i sam wywoła navigate po decyzji usera).
        const gate = useOfferStore.getState().navigationGate;
        if (gate && !gate(step + 1)) {
          // Gate już zareagował (otworzył modal); zatrzymujemy nawigację tutaj.
          Haptics.selectionAsync();
          return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('Dodaj', { screen: 'Step' + (step + 1) });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Brakuje danych", errorMessage);
      }
    }
  };

  // Ustawione kąty: 180° (lewo) = tryb ciemny, 270° (góra) = Discovery, 0° (prawo) = tryb jasny
  const quickActions = useMemo(
    () => [
      {
        key: 'THEME_DARK',
        label: 'Ciemny',
        icon: 'moon',
        angleDeg: 180,
        distance: 90,
        tint: '#818CF8',
        glassBg: resolvedDark ? 'rgba(129,140,248,0.32)' : 'rgba(99,102,241,0.22)',
        target: () => setThemeMode('dark'),
      },
      {
        key: 'DISCOVERY',
        label: 'Discovery',
        icon: 'sparkles',
        angleDeg: 270,
        distance: 105,
        tint: '#D4AF37',
        glassBg: resolvedDark ? 'rgba(212,175,55,0.28)' : 'rgba(212,175,55,0.2)',
        target: () => navigation.navigate('EstateDiscovery'),
      },
      {
        key: 'THEME_LIGHT',
        label: 'Jasny',
        icon: 'sunny',
        angleDeg: 0,
        distance: 130,
        tint: '#FBBF24',
        glassBg: resolvedDark ? 'rgba(251,191,36,0.28)' : 'rgba(251,191,36,0.2)',
        target: () => setThemeMode('light'),
      },
    ],
    [navigation, resolvedDark, setThemeMode],
  );

  const clearLongPressTimer = useCallback(() => {
    if (!longPressTimeoutRef.current) return;
    clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = null;
  }, []);

  const openQuickMenu = useCallback(() => {
    if (__DEV__) console.log('[PLUS] openQuickMenu');
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
    const limit = best.key === 'THEME_LIGHT' ? 8 : 35;
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

    if (__DEV__) console.log('[PLUS] release', { dx, dy, button: buttonLayoutRef.current });
    const selected = resolveHoveredAction(dx, dy);
    if (__DEV__) console.log('[PLUS] selected', selected);
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
        if (__DEV__) console.log('[PLUS] grant');
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
        if (__DEV__) console.log('[PLUS] move', { moveX: gestureState.moveX, moveY: gestureState.moveY, button: buttonLayoutRef.current, hovered });
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
  // Apple-glass grawer: w obu motywach FILL jest CZYSTY BIAŁY (max
  // jasność), a STROKE robi „halo" w opposite-tone, żeby litery były
  // czytelne ZARÓWNO na zielonym plus-przycisku, JAK i na szklanym tab
  // barze (jasnym lub ciemnym). To samo podejście stosuje Apple w iOS
  // HUD-ach (np. AirPods connect, AirDrop) — białe litery z mikro-obrysem.
  const circularLabelColor = '#FFFFFF';
  const circularLabelStroke = isDark
    ? 'rgba(0,0,0,0.70)'
    : 'rgba(15,23,42,0.62)';

  return (
    <View style={{ top: -35, justifyContent: 'center', alignItems: 'center' }}>
      {/*
        Diamentowy pierścień (108×108): krystalicznie przezroczysty z
        zewnętrznym halo światła. Wewnątrz dwa subtelne gradienty dają efekt
        szlifu diamentu — łukowy odblask u góry i miękki rozbłysk po skosie,
        ale CAŁOŚĆ pozostaje przejrzysta — widać przez nią tło tab bara.
      */}
      <View
        style={{
          position: 'absolute',
          width: 108,
          height: 108,
          borderRadius: 54,
          backgroundColor: 'transparent',
          borderWidth: 1.2,
          borderColor: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.95)',
          overflow: 'hidden',
          shadowColor: '#FFFFFF',
          shadowOpacity: isDark ? 0.22 : 0.6,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        }}
      >
        <LinearGradient
          colors={
            isDark
              ? ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.10)']
              : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.00)', 'rgba(255,255,255,0.20)']
          }
          locations={[0, 0.55, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={{
            position: 'absolute',
            top: 5,
            left: 18,
            right: 18,
            height: 12,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.7)',
            opacity: 0.85,
          }}
        />
      </View>
      {/*
        Cień pod diamentem — przejrzysty kółkowy „kosz" trzymający świecący
        plus. Bez własnego mlecznego tła; pełni rolę wyłącznie cieniującą.
      */}
      <View
        style={{
          position: 'absolute',
          width: 98,
          height: 98,
          borderRadius: 49,
          backgroundColor: 'transparent',
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.32 : 0.22,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 7 },
          elevation: 6,
        }}
      />
      <View ref={buttonRef} collapsable={false} {...panResponder.panHandlers} onLayout={() => { requestAnimationFrame(() => { buttonRef.current?.measureInWindow((x, y, w, h) => { buttonLayoutRef.current = { x: x + w/2, y: y + h/2 }; if (__DEV__) console.log('[PLUS] measureInWindow', { x, y, w, h, centerX: x + w/2, centerY: y + h/2 }); }); }); }}>
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

          {/*
            ╔══════════════════════════════════════════════════════════╗
            ║  GRAWEROWANE ETYKIETY APPLE-WATCH STYLE                 ║
            ║                                                          ║
            ║  Dwa OSOBNE komponenty zamontowane RÓWNOLEGLE — każdy   ║
            ║  ma WŁASNE, FIXED propsy (tekst, łuk, gap, font, offset).║
            ║  Przy przełączaniu między stanem plus-button a strzałką ║
            ║  zmienia się TYLKO `opacity` przez `Animated.timing`     ║
            ║  (crossfade 240 ms) — żaden SVG się nie remountuje,      ║
            ║  pozycje są zafiksowane, łuki nie skaczą.                ║
            ║                                                          ║
            ║  Dzięki temu napis zachowuje się DOKŁADNIE jak grawer    ║
            ║  na tarczy Apple Watch: stoi w miejscu, tylko zmienia    ║
            ║  treść z gładkim przejściem światła.                     ║
            ║                                                          ║
            ║  `pointerEvents='none'` na obu — żadnego konfliktu       ║
            ║  z gestami pan-responder / long-press.                   ║
            ╚══════════════════════════════════════════════════════════╝
          */}
          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', opacity: plusLabelOpacity }}
          >
            <CircularLabelRing
              text="DODAJ OFERTĘ"
              arcPosition="top"
              buttonDiameter={108}
              // Gap=17 → r≈77, czyli ~5 px POZA halo pierścienia
              // diamentowego (shadowRadius:18 sięga do r≈72). Skrajne
              // litery „DO" i „TĘ" przestają być wybielane przez halo.
              gap={17}
              fontSize={11.8}
              letterSpacing={2.2}
              // arcFraction 0.62 zamiast 0.72 — skrajne litery
              // skupiają się bliżej GÓRY łuku, daleko od bocznej
              // krawędzi pierścienia gdzie halo jest najgęstsze.
              arcFraction={0.62}
              color={circularLabelColor}
              strokeColor={circularLabelStroke}
              strokeWidth={0.85}
              submerge
              submergeMidpoint={0.56}
              // offset +60 → baseline napisu siada na linii krawędzi
              // szkła tab bara (dolne połówki znikają w pasku).
              verticalOffset={60}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={{ position: 'absolute', opacity: arrowLabelOpacity }}
          >
            <CircularLabelRing
              text="DALEJ"
              arcPosition="bottom"
              buttonDiameter={108}
              gap={8}
              fontSize={11}
              letterSpacing={3.4}
              arcFraction={0.42}
              color={circularLabelColor}
              strokeColor={circularLabelStroke}
              strokeWidth={0.55}
              submerge
              submergeMidpoint={0.5}
              // offset −40 → baseline „DALEJ" w środku pasa szkła,
              // między ikonami tab bara, bez nachodzenia.
              verticalOffset={-40}
            />
          </Animated.View>
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
                      : (resolvedDark ? 'rgba(22,22,24,0.85)' : 'rgba(255,255,255,0.92)'),
                    borderWidth: 1.5,
                    borderColor: isHovered ? item.tint : (resolvedDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                    shadowColor: '#000',
                    shadowOpacity: isHovered ? 0.3 : 0.12,
                    shadowRadius: isHovered ? 14 : 8,
                    shadowOffset: { width: 0, height: 6 },
                  }}
                >
                  <Ionicons name={item.icon as any} size={15} color={isHovered ? item.tint : (resolvedDark ? '#FFF' : '#1C1C1E')} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: isHovered ? item.tint : (resolvedDark ? '#FFF' : '#1C1C1E') }}>{item.label}</Text>
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
const LUXURY_TAB_PRESS_DELAY_MS = 68;

/**
 * Globalny Apple-style micro interaction dla zwykłych zakładek.
 *
 * Daje odczucie „premium delay”: najpierw lekki haptic + miękkie wciśnięcie
 * ikonki, dopiero po krótkiej pauzie przełącza ekran. Dzięki temu Radar,
 * Ulubione, Wiadomości i Profil zachowują się jak jeden dopracowany mechanizm,
 * bez dopisywania animacji w każdym ekranie osobno.
 */
function LuxuryTabBarButton(props: any) {
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  const animateTo = useCallback((pressed: boolean) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: pressed ? 0.92 : 1,
        friction: 7,
        tension: 170,
        useNativeDriver: true,
      }),
      Animated.spring(lift, {
        toValue: pressed ? 1 : 0,
        friction: 8,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [lift, scale]);

  const baseStyle = typeof props.style === 'function' ? props.style({ pressed: false }) : props.style;
  const isSelected = Boolean(props.accessibilityState?.selected);

  return (
    <Pressable
      {...props}
      style={[baseStyle, styles.luxuryTabButton]}
      onPressIn={(e) => {
        props.onPressIn?.(e);
        animateTo(true);
        void Haptics.selectionAsync().catch(() => undefined);
      }}
      onPressOut={(e) => {
        props.onPressOut?.(e);
        animateTo(false);
      }}
      onPress={(e) => {
        if (isSelected) {
          props.onPress?.(e);
          return;
        }
        setTimeout(() => props.onPress?.(e), LUXURY_TAB_PRESS_DELAY_MS);
      }}
    >
      <Animated.View
        style={[
          styles.luxuryTabButtonInner,
          {
            transform: [
              { scale },
              {
                translateY: lift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -2],
                }),
              },
            ],
          },
        ]}
      >
        {props.children}
      </Animated.View>
    </Pressable>
  );
}

function MainTabs({ splashDone }: { splashDone: boolean }) {
  const restoreSession = useAuthStore(state => state.restoreSession);
  const token = useAuthStore((state: any) => state.token);
  const systemColorScheme = useColorScheme();
  const themeMode = useThemeStore((state) => state.themeMode);
  /**
   * Liczba dealroomów z aktywną czerwoną kropką (z `DealroomListScreen`).
   *
   * UWAGA: nie sumujemy `deal.unread` (liczba nieprzeczytanych WIADOMOŚCI).
   * Bierzemy liczbę KART z czerwoną kropką, ponieważ kropka pojawia się także
   * przy zdarzeniach typu „partner skontrował termin/cenę — czeka na Twoją
   * reakcję", nawet gdy `unread === 0`. Synchronizacja przez globalny store
   * `useUnreadBadgeStore` — `DealroomListScreen` jest źródłem prawdy, my tylko
   * odzwierciedlamy jego liczbę na tabBarBadge i na ikonie aplikacji.
   */
  const unreadDealCount = useUnreadBadgeStore((state) => state.unreadDealCount);

  useEffect(() => { restoreSession(); }, []);

  // ──────────────────────────────────────────────────────────────────────
  // IAP BOOTSTRAP (App Store / Google Play)
  // ──────────────────────────────────────────────────────────────────────
  // Wymóg Apple Review Guideline 3.1.1: `purchaseUpdatedListener` musi
  // być zarejestrowany OD MOMENTU STARTU aplikacji — bo system może
  // doręczyć transakcję asynchronicznie (deferred / Ask to Buy / family
  // share / odzysk po crashu). Robimy to RAZ na poziomie root layout,
  // a wszystkie wywołania `purchaseConsumable` / `restorePurchases`
  // używają tego samego singletonu (`IAPManager`).
  //
  // `getToken` jako funkcja (a nie wartość) — bo użytkownik może
  // zalogować/wylogować się między startem aplikacji a kupnem; manager
  // bierze świeży token w momencie weryfikacji backendu.
  useEffect(() => {
    void IAPManager.init({
      apiUrl: API_URL,
      getToken: () => useAuthStore.getState().token,
    });
    // Brak `teardown` — manager jest singletonem i ma żyć dopóki żyje
    // proces aplikacji. React-native-iap nie lubi częstych
    // `endConnection`/`initConnection`, dlatego trzymamy jedno
    // połączenie do końca sesji.
  }, []);

  // ──────────────────────────────────────────────────────────────────────
  // BLOKADY UŻYTKOWNIKÓW (Apple Guideline 1.2 — UGC)
  // ──────────────────────────────────────────────────────────────────────
  // Hydrujemy lokalną listę zablokowanych USERÓW przy każdej zmianie
  // zalogowanego konta, a potem (jeśli mamy token) wołamy backend po
  // autorytatywną wersję. Filtry w listach ofert / czatów odpytują
  // `useBlockedUsersStore.isBlocked(userId)` synchronicznie — dzięki
  // hydracji w tym efekcie pierwszy render po starcie aplikacji już
  // pokazuje listę bez treści zablokowanych userów.
  useEffect(() => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      useBlockedUsersStore.getState().clear();
      return;
    }
    const tokenSnapshot = useAuthStore.getState().token;
    void (async () => {
      await useBlockedUsersStore.getState().hydrate(userId);
      if (tokenSnapshot) {
        void useBlockedUsersStore.getState().syncFromBackend(tokenSnapshot);
      }
    })();
  }, [token]);

  // Application Icon Badge — czerwone „1" na ikonie aplikacji (lockscreen / app
  // library / home screen). Aktualizujemy je za każdym razem, gdy zmieni się
  // liczba dealroomów wymagających uwagi, łącznie ze spadkiem do 0 (po wejściu
  // w czat backend resetuje `unread`, kropka znika z karty → store schodzi do 0
  // → badge na ikonie aplikacji znika automatycznie).
  useEffect(() => {
    if (!token) {
      void Notifications.setBadgeCountAsync(0).catch(() => undefined);
      return;
    }
    void Notifications.setBadgeCountAsync(unreadDealCount).catch(() => undefined);
  }, [unreadDealCount, token]);

  const resolvedTheme = themeMode === 'auto' ? (systemColorScheme ?? 'light') : themeMode;
  const currentColors = Colors[resolvedTheme];

  return (
    <Tab.Navigator
      /**
       * RN 0.81 + bottom-tabs `animation: 'shift'` + domyślne detach inactive screens
       * potrafią dać **pusty / biały ekran** przy pierwszym wejściu w zakładkę (iOS).
       * Zob. react-navigation#12755 — `detachInactiveScreens={false}` usuwa regresję.
       */
      detachInactiveScreens={false}
      screenOptions={{
      headerShown: false, 
      lazy: true,
      animation: 'shift',
      tabBarHideOnKeyboard: true,
      tabBarButton: (props) => <LuxuryTabBarButton {...props} />,
      tabBarShowLabel: true, 
      tabBarActiveTintColor: Colors.primary, 
      tabBarInactiveTintColor: currentColors.subtitle, 
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: -0.15,
        marginTop: 1,
      },
      tabBarItemStyle: {
        borderRadius: 20,
        marginHorizontal: 2,
      },
      tabBarBackground: () => (
        // Owijka klipuje BlurView tylko w obrębie tab bara, ale samej grupy
        // przycisków NIE klipujemy — dzięki temu wystający centralny „plus"
        // (FloatingNextButton) ma swobodę wychodzenia ponad krawędź paska.
        <View style={StyleSheet.absoluteFill as any} pointerEvents="none">
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <BlurView
              intensity={resolvedTheme === 'dark' ? 62 : 78}
              tint={resolvedTheme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor:
                    resolvedTheme === 'dark'
                      ? 'rgba(10,10,12,0.55)'
                      : 'rgba(255,255,255,0.55)',
                },
              ]}
            />
          </View>
        </View>
      ),
      tabBarStyle: {
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        height: 95,
        paddingBottom: 30,
        paddingTop: 10,
        // Plusik (FloatingNextButton) ma być widoczny w pełnej krasie nad paskiem,
        // dlatego sam tab bar nie klipuje swojej zawartości — klipuje tylko
        // tło (BlurView) wewnątrz `tabBarBackground`.
        overflow: 'visible',
        shadowColor: '#000',
        shadowOpacity: resolvedTheme === 'dark' ? 0.45 : 0.1,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: -8 },
        elevation: 14,
      },
      sceneStyle: {
        backgroundColor: resolvedTheme === 'dark' ? '#000000' : '#F2F2F7',
      },
    }}
    >
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
            <Ionicons name="chatbubble-ellipses" size={23} color={color} />
          ),
          // Natywny czerwony badge Apple-style — pokazuje DOKŁADNĄ liczbę
          // nieprzeczytanych wiadomości (1, 3, 12). React Navigation rysuje go
          // identycznie jak iOS rysuje badge na ikonie aplikacji.
          tabBarBadge: unreadDealCount > 0 ? (unreadDealCount > 99 ? '99+' : unreadDealCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#FF3B30',
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            lineHeight: 14,
            borderRadius: 9,
            paddingHorizontal: 5,
          },
        }}
      >
        {() => <DealroomListScreen />}
      </Tab.Screen>
      <Tab.Screen name="Profil" options={{ tabBarIcon: ({color}) => <Ionicons name="person-circle" size={28} color={color} /> }}>
        {(props) => (
          <ProfileScreen theme={currentColors} tabRouteParams={props.route.params as { authIntent?: 'login' | 'register' } | undefined} />
        )}
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
      params: {
        screen: 'Radar' | 'Ulubione' | 'Wiadomości';
        params?: Record<string, unknown>;
      };
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
    routeHint.includes('review') ||
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

  // 6) Fallback radar bez offerId — to typowy „Radar znalazł X ofert" zbiorczy
  // alert. Oprócz przekierowania na zakładkę Radar dostarczamy sygnał
  // `radarFocus: 'matches'`, dzięki któremu RadarHomeScreen sam podniesie
  // dedykowany tryb „Dopasowania Radaru" (banner + fit mapy + sama lista
  // dopasowań). Bez tego user wracał do generycznego widoku „Oferty w okolicy".
  if (looksLikeRadar || deeplinkLooksLikeRadar || deeplinkLower.includes('://radar')) {
    return {
      screen: 'MainTabs',
      params: { screen: 'Radar', params: { radarFocus: 'matches' } },
    };
  }

  return null;
};

export default function App() {
  const { token } = useAuthStore();
  const { askForPermission } = usePushNotifications(token);
  const systemColorScheme = useColorScheme();

  /** Live Activity: gasimy, gdy w store radar jest wyłączony. Z dysku NIGDY nie wyłączamy radaru w store (tylko użytkownik w kalibracji) — na `active` ewentualnie tylko „podciągamy” włączenie, gdy na dysku jest `1`, a store jeszcze `false` (race po hydratacji). */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void (async () => {
        try {
          const { user, isRadarActive, setRadarActive } = useAuthStore.getState();
          if (!user?.id) {
            await stopRadarLiveActivity();
            return;
          }
          const raw = await AsyncStorage.getItem('@estateos_radar_active');
          const diskOn = raw === '1';
          if (diskOn && !isRadarActive) {
            await setRadarActive(true);
          }
          if (!useAuthStore.getState().isRadarActive) {
            await stopRadarLiveActivity();
          }
        } catch {
          /* noop */
        }
      })();
    });
    return () => sub.remove();
  }, []);

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
    if (__DEV__) console.log('[PUSH][NAVIGATE]', navigationKey);
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
      if (__DEV__) {
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
      }
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
          <AppStack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'fade_from_bottom',
              animationDuration: 320,
              /**
               * Wyłączone w całej aplikacji: gest „przesuń w prawo / z krawędzi” zamykał ekrany
               * zamiast przewijać treść (częsty konflikt ze ScrollView). Powrót: przyciski w UI.
               */
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
              contentStyle: { backgroundColor: resolvedTheme === 'dark' ? '#000000' : '#F2F2F7' },
            }}
          >
            <AppStack.Screen name="MainTabs">
              {() => <MainTabs splashDone={!isSplashVisible} />}
            </AppStack.Screen>
            <AppStack.Screen name="RadarLegacy">
              {(props) => <Radar {...props} theme={Colors[resolvedTheme]} />}
            </AppStack.Screen>
            <AppStack.Screen
              name="OfferDetail"
              component={OfferDetail}
            />
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

const styles = StyleSheet.create({
  luxuryTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  luxuryTabButtonInner: {
    minWidth: 56,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
});
