import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, TextInput, KeyboardAvoidingView, Platform, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AppleHover from '../../components/AppleHover';

const Colors = { primary: '#10b981', aiGlow: '#8b5cf6', danger: '#ef4444' };
const MAX_TITLE_LENGTH = 70;

const InteractiveProgressBar = ({ step, total, theme, navigation }: any) => (
  <View style={styles.progressContainer}>
    <Text style={[styles.progressText, { color: theme.subtitle }]}>KROK {step} Z {total}</Text>
    <View style={{ flexDirection: 'row', gap: 6, height: 6 }}>
      {Array.from({ length: total }).map((_, i) => {
        const scaleAnim = useRef(new Animated.Value(1)).current;
        const opacityAnim = useRef(new Animated.Value(1)).current;
        const isCompleted = i + 1 <= step;
        return (
          <Pressable 
            key={i} 
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Dodaj', { screen: `Step${i + 1}` }); }}
            onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.8, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <Animated.View style={{ height: '100%', borderRadius: 3, backgroundColor: isCompleted ? Colors.primary : (theme.glass === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'), transform: [{ scaleY: scaleAnim }], opacity: opacityAnim }} />
          </Pressable>
        );
      })}
    </View>
  </View>
);

// BAZA SŁOWNICTWA AI
const aiVocabulary = {
  intros: [
    "Przekrocz próg przestrzeni, która redefiniuje pojęcie luksusu i komfortu.",
    "Rzadka okazja na rynku. Nieruchomość, która natychmiast przykuwa uwagę swoją unikalną architekturą.",
    "Oto miejsce stworzone z myślą o osobach ceniących miejski styl życia bez kompromisów.",
    "Harmonia, spokój i doskonały design. Ta propozycja zadowoli najbardziej wymagających klientów.",
    "Gotowa na nowego właściciela. Przestrzeń, która daje nieskończone możliwości aranżacyjne."
  ],
  poi: [
    "W promieniu 500 metrów znajdziesz renomowane szkoły, przedszkola oraz nowoczesny kompleks szpitalny.",
    "Doskonała komunikacja: zaledwie 3 minuty spacerem do głównych węzłów komunikacyjnych i bezpośredni dojazd do lotniska.",
    "Otoczenie to kwintesencja wielkomiejskiego życia: klimatyczne kawiarnie, wybitne restauracje i tętniące życiem muzea.",
    "Okolica łączy w sobie spokój zielonych parków z dostępem do pełnej infrastruktury usługowo-handlowej.",
    "Dla aktywnych: ścieżki rowerowe, kluby fitness i bliskość rzeki. Dla rodzin: bezpieczne place zabaw i szkoły dwujęzyczne."
  ]
};

export default function Step5_Media({ theme }: { theme: any }) {
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const navigation = useNavigation<any>();
  useFocusEffect(useCallback(() => { setCurrentStep(5); }, []));
  
  const [isGenerating, setIsGenerating] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;

  // --- TYTUŁ ---
  const handleTitleChange = (text: string) => {
    if (text.length <= MAX_TITLE_LENGTH) {
      updateDraft({ title: text });
    }
  };
  const titleCharsLeft = MAX_TITLE_LENGTH - (draft.title?.length || 0);
  const titleColor = titleCharsLeft < 10 ? Colors.danger : theme.subtitle;

  // --- ZDJĘCIA ---
  const pickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); updateDraft({ images: [...draft.images, ...result.assets.map(a => a.uri)] }); }
  };
  const removeImage = (indexToRemove: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ images: draft.images.filter((_, i) => i !== indexToRemove) });
  };
  const pickFloorPlan = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.8 });
    if (!result.canceled) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); updateDraft({ floorPlan: result.assets[0].uri }); }
  };
  const removeFloorPlan = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ floorPlan: null }); };

  // --- SILNIK AI ---
  const generateAI = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.loop(Animated.sequence([ Animated.timing(glowAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }), Animated.timing(glowAnim, { toValue: 0.1, duration: 800, useNativeDriver: true }) ])).start();

    // 1. Losowanie Intros i POI
    const randomIntro = aiVocabulary.intros[Math.floor(Math.random() * aiVocabulary.intros.length)];
    const randomPoi = aiVocabulary.poi[Math.floor(Math.random() * aiVocabulary.poi.length)];

    // 2. Formatowanie zmiennych
    const propType = draft.propertyType === 'HOUSE' ? 'dom' : draft.propertyType === 'PLOT' ? 'działkę' : 'apartament';
    const condition = draft.condition === 'READY' ? 'gotowy do wprowadzenia' : draft.condition === 'RENOVATION' ? 'z potencjałem do remontu' : 'w stanie deweloperskim';
    const transactionType = draft.transactionType === 'RENT' ? 'wynajem' : 'sprzedaż';

    // 3. Budowa Sekcji Bulletów (Tylko to co wypełniono)
    let bullets = "";
    if (draft.area) bullets += `\n📐 Powierzchnia: ${draft.area} m²`;
    if (draft.rooms) bullets += `\n🛏 Pokoje: ${draft.rooms}`;
    if (draft.floor) bullets += `\n🏢 Piętro: ${draft.floor}`;
    if (draft.buildYear) bullets += `\n🏗 Rok budowy: ${draft.buildYear}`;
    if (draft.rent) bullets += `\n💶 Czynsz adm.: ${draft.rent} PLN`;
    if (draft.deposit) bullets += `\n🛡 Kaucja: ${draft.deposit} PLN`;

    // 4. Składanie całości
    const fullText = `${randomIntro}\n\nPrezentujemy wyjątkowy ${propType} na ${transactionType}, zlokalizowany w sercu: ${draft.city || 'Miejscowości'} (${draft.district || 'centrum'}). Nieruchomość jest ${condition}, co czyni ją niezwykle atrakcyjną ofertą na obecnym rynku.\n\n✧ ANALIZA OKOLICY ✧\n${randomPoi}\n\n✧ KLUCZOWE PARAMETRY ✧${bullets}\n\nOdkryj pełen potencjał tego miejsca. Zapraszamy do kontaktu w celu umówienia prywatnej prezentacji.`;
    
    updateDraft({ description: '' });
    const words = fullText.split(' ');
    let currentWordIndex = 0; let tempText = '';

    // Efekt maszyny do pisania z haptyką
    const typingInterval = setInterval(() => {
      if (currentWordIndex < words.length) {
        tempText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
        updateDraft({ description: tempText });
        // Wibracja co 4 słowo dla "odczucia" pisania
        if (currentWordIndex % 4 === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        currentWordIndex++;
      } else {
        clearInterval(typingInterval); 
        setIsGenerating(false); 
        glowAnim.stopAnimation();
        Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 40); // Szybkość dopasowana do luksusowego czucia
  };

  const isDark = theme.glass === 'dark';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <View style={{ marginTop: 50 }} />
        <InteractiveProgressBar step={5} total={6} theme={theme} navigation={navigation} />
        <Text style={{ fontSize: 40, fontWeight: '800', marginBottom: 30, color: theme.text }}>Media i Opis</Text>
        
        {/* --- NOWOŚĆ: TYTUŁ Z LICZNIKIEM APPLE --- */}
        <View style={styles.titleSection}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle }}>Tytuł Oferty</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: titleColor }}>{titleCharsLeft} znaków</Text>
          </View>
          <View style={[styles.titleInputBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
            <TextInput 
              style={[styles.titleInput, { color: theme.text }]} 
              placeholder="np. Słoneczny apartament z widokiem na park" 
              placeholderTextColor={theme.subtitle} 
              value={draft.title} 
              onChangeText={handleTitleChange} 
              maxLength={MAX_TITLE_LENGTH}
            />
          </View>
        </View>

        {/* --- GALERIA ZDJĘĆ --- */}
        <Text style={{ fontSize: 14, fontWeight: '800', marginBottom: 15, textTransform: 'uppercase', color: theme.subtitle }}>Galeria Wnętrz</Text>
        
        {draft.images.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {draft.images.map((uri: string, index: number) => (
              <View key={index} style={{ width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                {index === 0 && (
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(16, 185, 129, 0.9)', paddingVertical: 4, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>OKŁADKA</Text>
                  </View>
                )}
                <Pressable onPress={() => removeImage(index)} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}><Ionicons name="close" size={16} color="#fff" /></Pressable>
              </View>
            ))}
          </View>
        )}

        <AppleHover onPress={pickGallery} style={{ width: '100%', height: 70, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: theme.glass === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', marginBottom: 15 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Ionicons name="images-outline" size={24} color={theme.text} style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{draft.images.length > 0 ? 'Dodaj kolejne zdjęcia' : 'Wybierz zdjęcia'}</Text>
          </View>
        </AppleHover>

        {/* --- RZUT NIERUCHOMOŚCI --- */}
        <Text style={{ fontSize: 14, fontWeight: '800', marginBottom: 15, marginTop: 15, textTransform: 'uppercase', color: theme.subtitle }}>Rzut (Plan Nieruchomości)</Text>
        <AppleHover onPress={pickFloorPlan} style={{ width: '100%', height: draft.floorPlan ? 200 : 70, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: theme.glass === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', marginBottom: 15, overflow: 'hidden' }}>
          {draft.floorPlan ? (
            <View style={{ width: '100%', height: '100%', position: 'relative' }}>
              <Image source={{ uri: draft.floorPlan }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <Pressable onPress={removeFloorPlan} style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }}><Ionicons name="close" size={18} color="#fff" /></Pressable>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Ionicons name="map-outline" size={24} color={theme.text} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Wgraj rzut z galerii</Text>
            </View>
          )}
        </AppleHover>

        {/* --- OPIS AI --- */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginBottom: 15 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle }}>Inteligentny Opis</Text>
          <AppleHover onPress={generateAI} scaleTo={1.05}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.aiGlow, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 }}>
              <Ionicons name="sparkles" size={16} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13, marginLeft: 6 }}>{isGenerating ? 'Analizuję...' : 'Wygeneruj Opis'}</Text>
            </View>
          </AppleHover>
        </View>
        
        <View style={{ position: 'relative' }}>
          <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.aiGlow, borderRadius: 24, opacity: glowAnim, transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] }) }] }]} />
          <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', padding: 20, minHeight: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 }}>
            <TextInput 
              multiline 
              style={{ fontSize: 15, fontWeight: '500', lineHeight: 24, color: theme.text, textAlignVertical: 'top' }} 
              placeholder="Pozwól AI przeanalizować Twoją nieruchomość i stworzyć idealny opis, lub wpisz go ręcznie..." 
              placeholderTextColor={theme.subtitle} 
              value={draft.description} 
              onChangeText={(t) => updateDraft({ description: t })} 
              editable={!isGenerating} 
            />
          </View>
        </View>
        
        <View style={{ height: 180 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ 
  progressContainer: { marginBottom: 30 }, 
  progressText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  titleSection: { marginBottom: 25 },
  titleInputBox: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  titleInput: { fontSize: 17, fontWeight: '600', paddingHorizontal: 20, paddingVertical: 18 }
});
