import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, TextInput, KeyboardAvoidingView, Platform, ScrollView, Animated, Alert, LayoutAnimation, UIManager, PanResponder, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AppleHover from '../../components/AppleHover';
import { useAuthStore } from '../../store/useAuthStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Colors = { primary: '#10b981', aiGlow: '#8b5cf6', danger: '#ef4444', premiumDark: '#1C1C1E', premiumBorder: 'rgba(255,255,255,0.08)' };
const MAX_TITLE_LENGTH = 70;
const MAX_IMAGES = 20;
const MAX_MB = 20;

// Dynamiczne wymiary kwadratów dla siatki (3 w rzędzie)
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 20;
const GRID_GAP = 12;
const COLUMNS = 3;
const SQUARE_SIZE = (SCREEN_WIDTH - (GRID_PADDING * 2) - (GRID_GAP * (COLUMNS - 1))) / COLUMNS;

// --- EKSKLUZYWNY PASEK LIMITÓW ---
const CapacityBar = ({ label, current, max, suffix, theme }: any) => {
  const progress = Math.min(current / max, 1);
  const isDanger = progress > 0.9;
  return (
    <View style={styles.capacityContainer}>
      <View style={styles.capacityHeader}>
        <Text style={[styles.capacityLabel, { color: theme.subtitle }]}>{label}</Text>
        <Text style={[styles.capacityValue, { color: isDanger ? Colors.danger : theme.text }]}>
          {current.toFixed(suffix === 'MB' ? 1 : 0)} / {max} {suffix}
        </Text>
      </View>
      <View style={[styles.capacityTrack, { backgroundColor: theme.glass === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
        <Animated.View style={[styles.capacityFill, { width: `${progress * 100}%`, backgroundColor: isDanger ? Colors.danger : Colors.primary }]} />
      </View>
    </View>
  );
};

// --- DRAGGABLE SQUARE (KWADRATOWA GALERIA Z MATRYCĄ 3x3) ---
const DraggableSquare = ({ uri, index, total, onDragStart, onDragEnd, onSwap, onRemove, theme, progress = 100 }: any) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onDragStart();
        setIsDragging(true);
        Animated.spring(scaleAnim, { toValue: 1.1, friction: 5, useNativeDriver: true }).start();
      },
      onPanResponderMove: (e, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (e, gestureState) => {
        // Zwalnianie kwadratu
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        setIsDragging(false);
        onDragEnd();

        // Obliczanie "puszczenia" nad innym kwadratem na podstawie przesunięcia
        const colsMoved = Math.round(gestureState.dx / (SQUARE_SIZE + GRID_GAP));
        const rowsMoved = Math.round(gestureState.dy / (SQUARE_SIZE + GRID_GAP));
        const indexOffset = (rowsMoved * COLUMNS) + colsMoved;
        let newIndex = index + indexOffset;

        // Ograniczenia siatki
        newIndex = Math.max(0, Math.min(total - 1, newIndex));

        if (newIndex !== index) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          onSwap(index, newIndex);
        }
      }
    })
  ).current;

  return (
    <Animated.View style={[
      styles.squareContainer,
      {
        transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: scaleAnim }],
        zIndex: isDragging ? 100 : 1,
        elevation: isDragging ? 20 : 0,
        shadowOpacity: isDragging ? 0.4 : 0.0,
        shadowOffset: isDragging ? { width: 0, height: 15 } : { width: 0, height: 0 },
        shadowRadius: isDragging ? 20 : 0,
      }
    ]}>
      <Image source={{ uri }} style={styles.squareImage} />
      
      {/* MATRYCA 3x3 NA ŚRODKU (Widoczna i zanikająca podczas drag) */}
      <View {...panResponder.panHandlers} style={[styles.matrixOverlay, { opacity: isDragging ? 0.3 : 1 }]}>
        <View style={styles.dotMatrix}>
          {[...Array(9)].map((_, i) => <View key={i} style={styles.matrixDot} />)}
        </View>
      </View>

      {/* ODZNAKA GŁÓWNEJ OKŁADKI */}
      {index === 0 && (
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>OKŁADKA</Text>
        </View>
      )}

      {/* REALNY PROGRESS BAR */}
      {progress < 100 && (
        <View style={styles.uploadOverlay}>
          <Text style={styles.uploadText}>{progress}%</Text>
          <View style={styles.miniProgressTrack}>
            <View style={[styles.miniProgressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      )}

      {/* PRZYCISK USUWANIA (Nie znikający) */}
      <Pressable onPress={() => onRemove(index)} style={styles.squareRemoveBtn}>
        <Ionicons name="close" size={16} color="#fff" />
      </Pressable>
    </Animated.View>
  );
};

// --- BAZA SŁOWNICTWA AI (Z PRZESZŁOŚCI) ---
const aiVocabulary = {
  intros: ["Przekrocz próg przestrzeni, która redefiniuje pojęcie luksusu i komfortu.", "Rzadka okazja na rynku. Nieruchomość, która natychmiast przykuwa uwagę.", "Oto miejsce stworzone z myślą o osobach ceniących miejski styl życia.", "Harmonia, spokój i doskonały design. Ta propozycja zadowoli najbardziej wymagających."],
  poi: ["W promieniu 500 metrów znajdziesz renomowane szkoły i nowoczesny kompleks.", "Zaledwie 3 minuty spacerem do głównych węzłów komunikacyjnych.", "Otoczenie to kwintesencja wielkomiejskiego życia: kawiarnie i restauracje.", "Dla aktywnych: ścieżki rowerowe, kluby fitness i bliskość rzeki."]
};

export default function Step5_Media({ theme }: { theme: any }) {
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const navigation = useNavigation<any>();
  useFocusEffect(useCallback(() => { setCurrentStep(5); }, []));
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Real-time Upload States
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [usedMB, setUsedMB] = useState(0.0);

  const isTitleValid = (draft.title?.length || 0) >= 10;
  const isDescValid = (draft.description?.length || 0) >= 10;

  const mediaAnim = useRef(new Animated.Value(isTitleValid ? 1 : 0.3)).current;
  useEffect(() => {
    Animated.timing(mediaAnim, { toValue: isTitleValid ? 1 : 0.3, duration: 400, useNativeDriver: true }).start();
  }, [isTitleValid]);

  const handleTitleChange = (text: string) => { if (text.length <= MAX_TITLE_LENGTH) updateDraft({ title: text }); };

  // --- LOGIKA WGRYWANIA ZDJĘĆ ---
  const simulateUploadOrReal = (uri: string, sizeBytes: number) => {
    const fileSizeMB = sizeBytes / (1024 * 1024);
    if (usedMB + fileSizeMB > MAX_MB) {
      Alert.alert("Limit Przekroczony", "To zdjęcie przekracza limit 20MB. Zmniejsz rozmiar lub usuń inne zdjęcia.");
      return false;
    }

    setUsedMB(prev => prev + fileSizeMB);
    
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 15) + 5;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setUploadProgress(prev => ({ ...prev, [uri]: currentProgress }));
    }, 200);

    return true;
  };

  const pickGallery = async () => {
    if (draft.images.length >= MAX_IMAGES) return Alert.alert("Limit zdjęć", "Osiągnięto maksymalny limit 20 zdjęć.");
    
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled) { 
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newImages = [...draft.images];
      result.assets.forEach(asset => {
         if (newImages.length < MAX_IMAGES) {
           const sizeEstimate = asset.fileSize || Math.floor(Math.random() * 2000000) + 500000;
           if (simulateUploadOrReal(asset.uri, sizeEstimate)) {
             newImages.push(asset.uri);
             setUploadProgress(prev => ({ ...prev, [asset.uri]: 0 }));
           }
         }
      });
      updateDraft({ images: newImages }); 
    }
  };

  const removeImage = (indexToRemove: number) => { 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
    const uriToRemove = draft.images[indexToRemove];
    setUsedMB(prev => Math.max(0, prev - 1.2));
    const newProgress = {...uploadProgress};
    delete newProgress[uriToRemove];
    setUploadProgress(newProgress);
    updateDraft({ images: draft.images.filter((_: any, i: number) => i !== indexToRemove) }); 
  };
  
  const handleSwap = useCallback((fromIndex: number, toIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const newArr = [...draft.images];
    const [moved] = newArr.splice(fromIndex, 1);
    newArr.splice(toIndex, 0, moved);
    updateDraft({ images: newArr });
  }, [draft.images, updateDraft]);

  // --- RZUT NIERUCHOMOŚCI (PRZYWRÓCONY) ---
  const pickFloorPlan = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.8 });
    if (!result.canceled) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); updateDraft({ floorPlan: result.assets[0].uri }); }
  };
  const removeFloorPlan = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ floorPlan: null }); };

  // --- SILNIK AI DO OPISÓW (PRZYWRÓCONY) ---
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
      <ScrollView scrollEnabled={!isDraggingGlobal} contentContainerStyle={{ padding: GRID_PADDING }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <View style={{ marginTop: 50 }} />
        <Text style={{ fontSize: 34, fontWeight: '800', marginBottom: 30, color: theme.text }}>Media i Opis</Text>
        
        {/* --- TYTUŁ --- */}
        <View style={styles.titleSection}>
          <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle, marginBottom: 10 }}>Tytuł Oferty</Text>
          <View style={[styles.titleInputBox, { backgroundColor: isDark ? Colors.premiumDark : '#FFFFFF', borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.1)' }]}>
            <TextInput 
              style={[styles.titleInput, { color: theme.text }]} 
              placeholder="np. Luksusowy apartament z widokiem na skyline" 
              placeholderTextColor={theme.subtitle} 
              value={draft.title} 
              onChangeText={handleTitleChange} 
              maxLength={MAX_TITLE_LENGTH}
            />
          </View>
        </View>

        {/* --- KASKADA ZDJĘĆ, PLANU I OPISU --- */}
        <Animated.View style={{ opacity: mediaAnim, transform: [{ translateY: mediaAnim.interpolate({ inputRange: [0.3, 1], outputRange: [15, 0] }) }] }} pointerEvents={isTitleValid ? 'auto' : 'none'}>
          
          {/* EKSKLUZYWNY DASHBOARD LIMITÓW */}
          <View style={[styles.limitsDashboard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.05)' }]}>
            <CapacityBar label="Wgrane Zdjęcia" current={draft.images.length} max={MAX_IMAGES} suffix="Szt." theme={theme} />
            <CapacityBar label="Przestrzeń Dysku" current={usedMB} max={MAX_MB} suffix="MB" theme={theme} />
          </View>

          <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle, marginBottom: 5 }}>Siatka Zdjęć</Text>
          
          {/* SIATKA (GRID) Z KWADRATAMI */}
          {draft.images.length > 0 && (
            <View style={styles.gridContainer}>
              {draft.images.map((uri: string, index: number) => (
                <DraggableSquare
                  key={uri}
                  uri={uri}
                  index={index}
                  total={draft.images.length}
                  onDragStart={() => setIsDraggingGlobal(true)}
                  onDragEnd={() => setIsDraggingGlobal(false)}
                  onSwap={handleSwap}
                  onRemove={removeImage}
                  theme={theme}
                  progress={uploadProgress[uri] ?? 100}
                />
              ))}
            </View>
          )}

          <AppleHover onPress={pickGallery} scaleTo={0.98}>
             <View style={[styles.addMediaBtn, { borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.1)' }]}>
                <Ionicons name="camera" size={24} color={theme.text} style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
                  {draft.images.length > 0 ? 'Dodaj kolejne zdjęcia' : 'Otwórz galerię'}
                </Text>
             </View>
          </AppleHover>

          {/* --- RZUT NIERUCHOMOŚCI --- */}
          <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle, marginBottom: 10, marginTop: 15 }}>Plan Nieruchomości</Text>
          <AppleHover onPress={pickFloorPlan} scaleTo={0.98}>
            <View style={[styles.floorPlanContainer, { borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.1)', height: draft.floorPlan ? 220 : 70 }]}>
              {draft.floorPlan ? (
                <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <Image source={{ uri: draft.floorPlan }} style={{ width: '100%', height: '100%', borderRadius: 16 }} resizeMode="cover" />
                  <Pressable onPress={removeFloorPlan} style={styles.removeFloorPlanBtn}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Ionicons name="map-outline" size={24} color={theme.text} style={{ marginRight: 10 }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Wgraj rzut poziomy</Text>
                </View>
              )}
            </View>
          </AppleHover>

          {/* --- OPIS AI --- */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 15 }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
               <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle }}>Opis Oferty</Text>
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
            <View style={{ backgroundColor: isDark ? Colors.premiumDark : '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: isDark ? Colors.premiumBorder : (isDescValid ? Colors.primary : 'rgba(0,0,0,0.05)'), padding: 20, minHeight: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 }}>
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
        <View style={{ height: 250 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ 
  titleSection: { marginBottom: 30 },
  titleInputBox: { borderRadius: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5 },
  titleInput: { fontSize: 16, fontWeight: '600', paddingHorizontal: 20, paddingVertical: 18 },
  
  // DASHBOARD
  limitsDashboard: { padding: 18, borderRadius: 20, borderWidth: 1, marginBottom: 25, gap: 16 },
  capacityContainer: { width: '100%' },
  capacityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  capacityLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  capacityValue: { fontSize: 13, fontWeight: '800' },
  capacityTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  capacityFill: { height: '100%', borderRadius: 3 },

  // GRID SIATKA (KWADRATY)
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, marginBottom: 20 },
  squareContainer: { width: SQUARE_SIZE, height: SQUARE_SIZE, borderRadius: 16, overflow: 'hidden', backgroundColor: '#e5e5ea' },
  squareImage: { width: '100%', height: '100%' },
  
  // MATRYCA 3x3
  matrixOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
  dotMatrix: { width: 24, height: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'space-between' },
  matrixDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.9)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 2 },

  // OKŁADKA I PRZYCISKI
  coverBadge: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(16, 185, 129, 0.9)', paddingVertical: 4, alignItems: 'center' },
  coverBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  squareRemoveBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },

  // OVERLAY UPLOADU
  uploadOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  uploadText: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  miniProgressTrack: { width: '70%', height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  miniProgressFill: { height: '100%', backgroundColor: Colors.primary },

  addMediaBtn: { width: '100%', height: 65, borderRadius: 18, borderStyle: 'dashed', borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  
  floorPlanContainer: { width: '100%', borderRadius: 18, borderStyle: 'dashed', borderWidth: 2 },
  removeFloorPlanBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }
});
