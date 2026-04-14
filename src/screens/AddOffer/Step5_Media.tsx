import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, TextInput, KeyboardAvoidingView, Platform, ScrollView, Animated, Alert, LayoutAnimation, UIManager, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AppleHover from '../../components/AppleHover';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Colors = { primary: '#10b981', aiGlow: '#8b5cf6', danger: '#ef4444' };
const MAX_TITLE_LENGTH = 70;
const ROW_HEIGHT = 92; // 80px wysokości karty + 12px przerwy

// --- PASKU POSTĘPU ---
const InteractiveProgressBar = ({ step, total, theme, navigation, canProceed }: any) => (
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
            onPress={() => { 
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
              if (i + 1 > step && !canProceed) {
                Alert.alert("Brakuje danych", "Aby przejść do ostatniego kroku, musisz wpisać minimum 10 znaków w Tytule oraz 10 znaków w Opisie.");
              } else {
                navigation.navigate('Dodaj', { screen: `Step${i + 1}` }); 
              }
            }}
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

// --- KOMPONENT DRAG & DROP DLA POJEDYNCZEGO ZDJĘCIA ---
const DraggableRow = ({ uri, index, total, onDragStart, onDragEnd, onSwap, onRemove, theme }: any) => {
  const panY = useRef(new Animated.Value(0)).current;
  const [isDragging, setIsDragging] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onDragStart();
        setIsDragging(true);
        Animated.spring(scaleAnim, { toValue: 1.05, useNativeDriver: true }).start();
      },
      onPanResponderMove: (e, gestureState) => {
        panY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (e, gestureState) => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        setIsDragging(false);
        onDragEnd();

        // Obliczamy o ile slotów użytkownik przesunął palec
        const moveSlots = Math.round(gestureState.dy / ROW_HEIGHT);
        let newIndex = index + moveSlots;
        newIndex = Math.max(0, Math.min(total - 1, newIndex)); // Blokada przed wyjechaniem poza tablicę

        panY.setValue(0); // Resetujemy przesunięcie wizualne (zaraz ułoży to LayoutAnimation)
        if (newIndex !== index) {
          onSwap(index, newIndex);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    })
  ).current;

  const isDark = theme.glass === 'dark';

  return (
    <Animated.View style={[
      styles.rowContainer,
      {
        backgroundColor: isDark ? 'rgba(30,30,34,0.9)' : '#FFFFFF',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        transform: [{ translateY: panY }, { scale: scaleAnim }],
        zIndex: isDragging ? 100 : 1,
        elevation: isDragging ? 20 : 0,
        shadowOpacity: isDragging ? 0.3 : 0.03,
        shadowOffset: isDragging ? { width: 0, height: 10 } : { width: 0, height: 2 },
        shadowRadius: isDragging ? 15 : 5,
      }
    ]}>
       {/* UCHWYT (6 KROPECZEK) */}
       <View {...panResponder.panHandlers} style={styles.dragHandle}>
         <View style={styles.dotsMatrix}>
           {[...Array(6)].map((_, i) => <View key={i} style={styles.dot} />)}
         </View>
       </View>

       <Image source={{ uri }} style={styles.rowThumbnail} />

       <View style={styles.rowText}>
         <Text style={[styles.rowLabel, { color: index === 0 ? Colors.primary : theme.text }]}>
           {index === 0 ? 'OKŁADKA' : `ZDJĘCIE ${index + 1}`}
         </Text>
         {index === 0 && <Text style={{ fontSize: 10, color: theme.subtitle, marginTop: 2 }}>Zobaczą to jako pierwsze</Text>}
       </View>

       <Pressable onPress={() => onRemove(index)} style={styles.removeBtn}>
         <Ionicons name="trash-outline" size={18} color={Colors.danger} />
       </Pressable>
    </Animated.View>
  );
};

// BAZA SŁOWNICTWA AI
const aiVocabulary = {
  intros: ["Przekrocz próg przestrzeni, która redefiniuje pojęcie luksusu i komfortu.", "Rzadka okazja na rynku. Nieruchomość, która natychmiast przykuwa uwagę.", "Oto miejsce stworzone z myślą o osobach ceniących miejski styl życia.", "Harmonia, spokój i doskonały design. Ta propozycja zadowoli najbardziej wymagających."],
  poi: ["W promieniu 500 metrów znajdziesz renomowane szkoły i nowoczesny kompleks.", "Zaledwie 3 minuty spacerem do głównych węzłów komunikacyjnych.", "Otoczenie to kwintesencja wielkomiejskiego życia: kawiarnie i restauracje.", "Dla aktywnych: ścieżki rowerowe, kluby fitness i bliskość rzeki."]
};

export default function Step5_Media({ theme }: { theme: any }) {
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const navigation = useNavigation<any>();
  useFocusEffect(useCallback(() => { setCurrentStep(5); }, []));
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false); // Blokuje scroll strony podczas przeciągania
  const glowAnim = useRef(new Animated.Value(0)).current;

  // --- LOGIKA KASKADY ---
  const titleLength = draft.title?.length || 0;
  const descLength = draft.description?.length || 0;
  
  const isTitleValid = titleLength >= 10;
  const isDescValid = descLength >= 10;
  const canProceed = isTitleValid && isDescValid; // Zwalnia strzałkę dalej

  const mediaAnim = useRef(new Animated.Value(isTitleValid ? 1 : 0.3)).current;

  useEffect(() => {
    Animated.timing(mediaAnim, { toValue: isTitleValid ? 1 : 0.3, duration: 400, useNativeDriver: true }).start();
  }, [isTitleValid]);

  // --- TYTUŁ ---
  const handleTitleChange = (text: string) => { if (text.length <= MAX_TITLE_LENGTH) updateDraft({ title: text }); };
  const titleCharsLeft = MAX_TITLE_LENGTH - titleLength;
  const titleColor = titleCharsLeft < 10 ? Colors.danger : (isTitleValid ? Colors.primary : theme.subtitle);

  // --- ZDJĘCIA (Zarządzanie Tablicą DND) ---
  const pickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); updateDraft({ images: [...draft.images, ...result.assets.map(a => a.uri)] }); }
  };
  const removeImage = (indexToRemove: number) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ images: draft.images.filter((_, i) => i !== indexToRemove) }); };
  
  // Magia płynnej zamiany miejscami
  const handleSwap = useCallback((fromIndex: number, toIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newArr = [...draft.images];
    const [moved] = newArr.splice(fromIndex, 1);
    newArr.splice(toIndex, 0, moved);
    updateDraft({ images: newArr });
  }, [draft.images, updateDraft]);

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

    const randomIntro = aiVocabulary.intros[Math.floor(Math.random() * aiVocabulary.intros.length)];
    const randomPoi = aiVocabulary.poi[Math.floor(Math.random() * aiVocabulary.poi.length)];
    const propType = draft.propertyType === 'HOUSE' ? 'dom' : draft.propertyType === 'PLOT' ? 'działkę' : 'apartament';
    const condition = draft.condition === 'READY' ? 'gotowy do wprowadzenia' : draft.condition === 'RENOVATION' ? 'z potencjałem do remontu' : 'w stanie deweloperskim';
    const transactionType = draft.transactionType === 'RENT' ? 'wynajem' : 'sprzedaż';

    let bullets = "";
    if (draft.area) bullets += `\n📐 Powierzchnia: ${draft.area} m²`;
    if (draft.rooms) bullets += `\n🛏 Pokoje: ${draft.rooms}`;
    if (draft.floor) bullets += `\n🏢 Piętro: ${draft.floor}`;
    if (draft.rent) bullets += `\n💶 Czynsz adm.: ${draft.rent} PLN`;

    const fullText = `${randomIntro}\n\nPrezentujemy wyjątkowy ${propType} na ${transactionType}, zlokalizowany w sercu: ${draft.city || 'Miejscowości'}. Nieruchomość jest ${condition}, co czyni ją niezwykle atrakcyjną ofertą.\n\n✧ ANALIZA OKOLICY ✧\n${randomPoi}\n\n✧ KLUCZOWE PARAMETRY ✧${bullets}\n\nZapraszamy do kontaktu w celu umówienia prywatnej prezentacji.`;
    
    updateDraft({ description: '' });
    const words = fullText.split(' ');
    let currentWordIndex = 0; let tempText = '';

    const typingInterval = setInterval(() => {
      if (currentWordIndex < words.length) {
        tempText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
        updateDraft({ description: tempText });
        if (currentWordIndex % 4 === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        currentWordIndex++;
      } else {
        clearInterval(typingInterval); 
        setIsGenerating(false); 
        glowAnim.stopAnimation();
        Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 40); 
  };

  const isDark = theme.glass === 'dark';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.background }}>
      {/* ScrollView musi być zablokowane podczas drag&drop, żeby palec nie przewijał strony */}
      <ScrollView scrollEnabled={!isDraggingGlobal} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <View style={{ marginTop: 50 }} />
        <InteractiveProgressBar step={5} total={6} theme={theme} navigation={navigation} canProceed={canProceed} />
        <Text style={{ fontSize: 40, fontWeight: '800', marginBottom: 30, color: theme.text }}>Media i Opis</Text>
        
        {/* --- TYTUŁ (Zawsze aktywny) --- */}
        <View style={styles.titleSection}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle }}>Tytuł Oferty</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: titleColor }}>{titleCharsLeft} znaków</Text>
          </View>
          <View style={[styles.titleInputBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : (isTitleValid ? Colors.primary : 'rgba(0,0,0,0.1)') }]}>
            <TextInput 
              style={[styles.titleInput, { color: theme.text }]} 
              placeholder="np. Słoneczny apartament z widokiem na park" 
              placeholderTextColor={theme.subtitle} 
              value={draft.title} 
              onChangeText={handleTitleChange} 
              maxLength={MAX_TITLE_LENGTH}
            />
          </View>
          {!isTitleValid && <Text style={{ fontSize: 11, color: theme.subtitle, marginTop: 6, marginLeft: 4 }}>* Wpisz min. 10 znaków, aby odblokować galerię</Text>}
        </View>

        {/* --- KASKADA (Media i Opis) --- */}
        <Animated.View 
          style={{ opacity: mediaAnim, transform: [{ translateY: mediaAnim.interpolate({ inputRange: [0.3, 1], outputRange: [15, 0] }) }] }} 
          pointerEvents={isTitleValid ? 'auto' : 'none'}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', marginBottom: 15, textTransform: 'uppercase', color: theme.subtitle }}>Galeria Wnętrz</Text>
          
          {draft.images.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              {/* Instrukcja obsługi w stylu Apple */}
              <View style={styles.instructionBox}>
                <Ionicons name="information-circle-outline" size={16} color={theme.subtitle} style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={[styles.instructionText, { color: theme.subtitle }]}>
                  Instrukcja obsługi: Przytrzymaj palcem 6 kropeczek z lewej strony i przesuń zdjęcie, aby zmienić kolejność. Pierwsze zdjęcie staje się główną okładką oferty.
                </Text>
              </View>

              {/* Lista Drag&Drop */}
              <View style={{ gap: 12 }}>
                {draft.images.map((uri: string, index: number) => (
                  <DraggableRow
                    key={uri} // Unikalny klucz URI gwarantuje bezbłędne ułożenie przy LayoutAnimation
                    uri={uri}
                    index={index}
                    total={draft.images.length}
                    onDragStart={() => setIsDraggingGlobal(true)}
                    onDragEnd={() => setIsDraggingGlobal(false)}
                    onSwap={handleSwap}
                    onRemove={removeImage}
                    theme={theme}
                  />
                ))}
              </View>
            </View>
          )}

          <AppleHover onPress={pickGallery} style={{ width: '100%', height: 70, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: theme.glass === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', marginBottom: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Ionicons name="images-outline" size={24} color={theme.text} style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{draft.images.length > 0 ? 'Dodaj kolejne zdjęcia' : 'Wybierz zdjęcia'}</Text>
            </View>
          </AppleHover>

          {/* RZUT NIERUCHOMOŚCI */}
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

          {/* OPIS AI */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginBottom: 15 }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
               <Text style={{ fontSize: 14, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle }}>Opis Oferty</Text>
               {!isDescValid && <Text style={{ fontSize: 11, color: Colors.danger, marginLeft: 8 }}>* (min. 10 znaków)</Text>}
            </View>
            <AppleHover onPress={generateAI} scaleTo={1.05}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.aiGlow, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 }}>
                <Ionicons name="sparkles" size={16} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13, marginLeft: 6 }}>{isGenerating ? 'Analizuję...' : 'Wygeneruj AI'}</Text>
              </View>
            </AppleHover>
          </View>
          
          <View style={{ position: 'relative' }}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.aiGlow, borderRadius: 24, opacity: glowAnim, transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] }) }] }]} />
            <View style={{ backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : (isDescValid ? Colors.primary : 'rgba(0,0,0,0.05)'), padding: 20, minHeight: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 }}>
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
        </Animated.View>
        
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
  titleInput: { fontSize: 17, fontWeight: '600', paddingHorizontal: 20, paddingVertical: 18 },
  
  // Style nowej listy Drag & Drop
  instructionBox: { flexDirection: 'row', backgroundColor: 'rgba(150,150,150,0.05)', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(150,150,150,0.1)', alignItems: 'flex-start' },
  instructionText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '500' },
  rowContainer: { flexDirection: 'row', alignItems: 'center', height: 80, borderRadius: 16, borderWidth: 1, paddingRight: 15, paddingVertical: 10 },
  dragHandle: { width: 45, height: '100%', justifyContent: 'center', alignItems: 'center' },
  dotsMatrix: { width: 10, height: 18, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'space-between' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#8E8E93' },
  rowThumbnail: { width: 60, height: 60, borderRadius: 10, marginRight: 15 },
  rowText: { flex: 1, justifyContent: 'center' },
  rowLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  removeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center' }
});
