import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import { useThemeStore } from '../store/useThemeStore';
import * as Haptics from 'expo-haptics';

export default function TermsScreen() {
  const navigation = useNavigation();
  const themeMode = useThemeStore(s => s.themeMode);
  const isDark = themeMode === 'dark';
  const bgColor = isDark ? '#000000' : '#f5f5f7';
  const textColor = isDark ? '#ffffff' : '#1d1d1f';
  const subColor = isDark ? '#86868b' : '#86868b';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.header}>
        <View style={styles.notch} />
        <Text style={[styles.headerTitle, { color: textColor }]}>Regulamin EstateOS™</Text>
        <Pressable 
          onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }} 
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>Gotowe</Text>
        </Pressable>
      </BlurView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: textColor }]}>Warunki Świadczenia Usług</Text>
        <Text style={[styles.date, { color: subColor }]}>Ostatnia aktualizacja: Kwiecień 2026</Text>

        <Text style={[styles.paragraph, { color: textColor }]}>
          Witamy w ekosystemie EstateOS™. Korzystając z naszej aplikacji, akceptujesz poniższe warunki, które zostały stworzone w celu zapewnienia najwyższej jakości i bezpieczeństwa dla wszystkich użytkowników.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>1. Postanowienia ogólne</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          EstateOS™ jest platformą łączącą osoby poszukujące nieruchomości z właścicielami i partnerami. Zobowiązujesz się do podawania prawdziwych informacji oraz przestrzegania zasad uczciwej konkurencji na rynku nieruchomości.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>2. Weryfikacja Ofert</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Dbając o standard premium, każda nowa oferta oraz znaczące zmiany w ofertach istniejących podlegają weryfikacji przez nasz zespół. Zastrzegamy sobie prawo do odrzucenia ogłoszeń niespełniających standardów wizualnych lub merytorycznych.
        </Text>

        <Text style={[styles.sectionTitle, { color: textColor }]}>3. Ochrona Prywatności</Text>
        <Text style={[styles.paragraph, { color: textColor }]}>
          Twoje dane są przetwarzane zgodnie z najwyższymi standardami bezpieczeństwa. Funkcja „Przybliżonej lokalizacji” chroni prywatność właścicieli, ukrywając dokładny adres przed nieautoryzowanym dostępem.
        </Text>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 15 : 20, paddingBottom: 15, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: 'rgba(150,150,150,0.2)', zIndex: 10 },
  notch: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,150,0.4)', marginBottom: 15 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  closeBtn: { position: 'absolute', right: 20, top: Platform.OS === 'ios' ? 32 : 37 },
  closeText: { color: '#0071e3', fontSize: 17, fontWeight: '600' },
  content: { padding: 25, paddingTop: 30 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 5 },
  date: { fontSize: 13, fontWeight: '500', marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 25, marginBottom: 10 },
  paragraph: { fontSize: 16, lineHeight: 24, fontWeight: '400', opacity: 0.9 },
});
