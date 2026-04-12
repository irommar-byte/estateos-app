import OfferDetail from './src/screens/OfferDetail';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Pressable, Animated, Alert, useColorScheme, ScrollView } from 'react-native';
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
import Step1_Type from './src/screens/AddOffer/Step1_Type';
import Step2_Location from './src/screens/AddOffer/Step2_Location';
import Step3_Parameters from './src/screens/AddOffer/Step3_Parameters';
import Step4_Finance from './src/screens/AddOffer/Step4_Finance';
import Step5_Media from './src/screens/AddOffer/Step5_Media';
import Step6_Summary from './src/screens/AddOffer/Step6_Summary';
import AuthScreen from './src/screens/AuthScreen';

const Colors = { light: { background: '#f5f5f7', text: '#1d1d1f', subtitle: '#86868b', glass: 'light' as const }, dark: { background: '#000000', text: '#f5f5f7', subtitle: '#86868b', glass: 'dark' as const }, primary: '#10b981' };
const modes: { label: string; value: ThemeMode }[] = [ { label: 'Jasny', value: 'light' }, { label: 'Auto', value: 'auto' }, { label: 'Ciemny', value: 'dark' } ];

import ProfileScreen from './src/screens/ProfileScreen';

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
  const { isLoggedIn } = useAuthStore();
  const navigation = useNavigation<any>();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const themeMode = useThemeStore(s => s.themeMode);
  const isDark = themeMode === 'dark';

  // NIEZAWODNE SPRAWDZANIE AKTYWNEJ ZAKŁADKI:
  const activeRouteName = useNavigationState(state => state?.routes[state.index]?.name || 'Radar');
  const isFocused = activeRouteName === 'Dodaj';

  let isValid = false; let errorMessage = "Wypełnij wszystkie wymagane pola.";
  if (currentStep === 1) { isValid = !!draft.transactionType && !!draft.propertyType && !!draft.condition; }
  else if (currentStep === 2) { isValid = !!draft.city && !!draft.district; errorMessage = "Wybierz Miasto i Dzielnicę"; }
  else if (currentStep === 3) { isValid = !!draft.area; errorMessage = "Wpisz metraż"; }
  else if (currentStep === 4) { isValid = !!draft.price; errorMessage = "Wpisz cenę nieruchomości"; }
  else if (currentStep === 5) { isValid = draft.images.length > 0; errorMessage = "Dodaj minimum 1 zdjęcie"; }

  useEffect(() => {
    if (isValid && currentStep > 0 && currentStep < 6 && isFocused) {
      Animated.loop(Animated.sequence([ Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }) ])).start();
    } else {
      pulseAnim.stopAnimation(); pulseAnim.setValue(1);
    }
  }, [isValid, currentStep, isFocused]);

  const handlePress = (e: any) => {
    if (!isFocused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('Dodaj'); // Wymusza przejście na zakładkę dodawania
      return;
    }

    if (currentStep === 0) {
      if (!isLoggedIn) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); navigation.navigate('Profil'); }
      else { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress(e); }
    }
    else if (currentStep === 6) { }
    else {
      if (isValid) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('Dodaj', { screen: `Step${currentStep + 1}` }); }
      else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); Alert.alert("Brakuje danych", errorMessage); }
    }
  };

  if (currentStep === 6 && isFocused) return <View style={{ width: 80 }} />;

  const isArrow = isFocused && currentStep > 0;
  const isReady = !isFocused || currentStep === 0 || isValid;

  return (
    <View style={{ top: -35, justifyContent: 'center', alignItems: 'center' }}>
      <Pressable onPress={handlePress}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }], width: 80, height: 80, borderRadius: 40, backgroundColor: isReady ? Colors.primary : (isDark ? '#222' : '#e5e5e5'), justifyContent: 'center', alignItems: 'center', borderWidth: 6, borderColor: isDark ? '#111' : '#ffffff', shadowColor: isReady ? Colors.primary : '#000', shadowOpacity: 0.4, shadowOffset: {width:0, height:8}, shadowRadius: 16 }}>
          <Ionicons name={isArrow ? "arrow-forward" : "add"} size={40} color={isReady ? "#fff" : (isDark ? "#666" : "#aaa")} />
        </Animated.View>
      </Pressable>
    </View>
  );
};

const Tab = createBottomTabNavigator();
function MainTabs() {
  const { checkUser } = useAuthStore();
  const systemColorScheme = useColorScheme();
  const themeMode = useThemeStore((state) => state.themeMode);
  
  useEffect(() => { checkUser(); }, []);

  const resolvedTheme = themeMode === 'auto' ? (systemColorScheme === 'light' ? 'light' : 'dark') : themeMode;
  const currentColors = Colors[resolvedTheme];

  
    return (
        <Tab.Navigator screenOptions={{ headerShown: false, tabBarShowLabel: true, tabBarActiveTintColor: Colors.primary, tabBarInactiveTintColor: currentColors.subtitle, tabBarStyle: { backgroundColor: resolvedTheme === 'dark' ? '#111' : '#ffffff', borderTopWidth: 0, height: 95, paddingBottom: 30, paddingTop: 10 } }}>
          <Tab.Screen name="Radar" options={{ tabBarIcon: ({color}) => <Ionicons name="map" size={26} color={color} /> }}>{() => <Radar theme={currentColors} />}</Tab.Screen>
          <Tab.Screen name="Dodaj" options={{ tabBarLabel: '', tabBarButton: (props) => <FloatingNextButton {...props} /> }}>{() => <AddOfferNavigator theme={currentColors} />}</Tab.Screen>
          <Tab.Screen name="Profil" options={{ tabBarIcon: ({color}) => <Ionicons name="person-circle" size={28} color={color} /> }}>{() => <ProfileScreen theme={currentColors} />}</Tab.Screen>
        </Tab.Navigator>
    );
    
}

const AppStack = createNativeStackNavigator();

export default function App() {
  const { checkUser } = useAuthStore();
  const systemColorScheme = useColorScheme();
  const themeMode = useThemeStore((state) => state.themeMode);
  
  React.useEffect(() => { checkUser(); }, []);

  const resolvedTheme = themeMode === 'auto' ? (systemColorScheme === 'light' ? 'light' : 'dark') : themeMode;
  const currentColors = Colors[resolvedTheme];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
        <AppStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          {/* Tu ładujemy wszystkie zakładki z paskiem na dole */}
          <AppStack.Screen name="MainTabs" component={MainTabs} />
          {/* A tu ładujemy nasz potężny ekran na pełnej szerokości */}
          <AppStack.Screen name="OfferDetail" component={OfferDetail} />
        </AppStack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
