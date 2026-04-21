import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Send, Paperclip, Check, CheckCheck } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay } from 'react-native-reanimated';
import { useAuthStore } from '../store/useAuthStore';

const TypingDot = ({ delay }: { delay: number }) => {
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withRepeat(withDelay(delay, withSequence(withTiming(-5, { duration: 300 }), withTiming(0, { duration: 300 }), withTiming(0, { duration: 600 }))), -1, true);
  }, []);
  return <Animated.View style={[styles.typingDot, useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] } ))]} />;
};

export default function DealroomChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const dealId = route.params?.dealId || route.params?.params?.dealId;
  const title = route.params?.title || route.params?.params?.title || 'Transakcja';
  
  const { user, token } = useAuthStore() as any;

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const lastTypingTime = useRef(0);

  // KULOODPORNE POBIERANIE (GET + ANTI-CACHE)
  const fetchMessages = useCallback(async () => {
    if (!token || !dealId) return;
    try {
      const url = `https://estateos.pl/api/mobile/v1/deals/${dealId}/messages?t=${Date.now()}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
      
      const text = await res.text();
      if (!text) return; // Chroni przed "Unexpected end of input"
      
      const data = JSON.parse(text);
      if (data.messages) {
        setMessages(data.messages);
      }
      if (data.isTyping !== undefined) {
        setIsPartnerTyping(data.isTyping);
      }
    } catch (e) {
      console.log('Ciche zignorowanie błędu odświeżania:', e);
    } finally {
      setLoading(false);
    }
  }, [dealId, token]);

  // POLLING CO 2.5 SEKUNDY
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2500);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleTyping = (text: string) => {
    setMessage(text);
    const now = Date.now();
    if (text.length > 0 && now - lastTypingTime.current > 1500) {
      lastTypingTime.current = now;
      fetch(`https://estateos.pl/api/mobile/v1/deals/${dealId}/typing`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !token || !user) return;
    const content = message.trim();
    setMessage('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const tempId = Date.now();
    setMessages(prev => [...prev, { id: tempId, senderId: user.id, content, createdAt: new Date().toISOString(), isRead: false }]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await fetch(`https://estateos.pl/api/mobile/v1/deals/${dealId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (res.ok) fetchMessages();
    } catch (e) {
      console.log('Błąd wysyłania:', e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }} style={styles.backButton}>
          <ChevronLeft size={28} color="#ffffff" />
        </Pressable>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerSubtitle}>DEALROOM #{dealId}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderCenter}><ActivityIndicator color="#10b981" /></View>
      ) : (
        <ScrollView 
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={styles.chatArea} 
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, index) => {
            const isMe = msg.senderId === user?.id;
            return (
              <Animated.View key={msg.id} entering={FadeInDown.delay(index * 15).springify()} style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem]}>
                <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
                  <Text style={styles.messageText}>{msg.content}</Text>
                </View>
                <View style={[styles.messageFooter, isMe ? styles.messageFooterMe : styles.messageFooterThem]}>
                  <Text style={styles.timeText}>{new Date(msg.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</Text>
                  {isMe && (
                    <View style={styles.readReceipt}>
                      {msg.isRead ? <CheckCheck size={15} color="#10b981" /> : <Check size={15} color="#86868b" />}
                    </View>
                  )}
                </View>
              </Animated.View>
            );
          })}
          
          {isPartnerTyping && (
            <Animated.View entering={FadeIn} style={styles.typingContainer}>
              <View style={styles.typingBubble}>
                <TypingDot delay={0} /><TypingDot delay={150} /><TypingDot delay={300} />
              </View>
            </Animated.View>
          )}
        </ScrollView>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <BlurView intensity={90} tint="dark" style={styles.inputContainer}>
          <Pressable style={styles.attachButton}><Paperclip size={22} color="#86868b" /></Pressable>
          <TextInput
            style={styles.textInput}
            placeholder="Napisz wiadomość..."
            placeholderTextColor="#666666"
            value={message}
            onChangeText={handleTyping}
            multiline
          />
          <Pressable style={[styles.sendButton, message.trim() && styles.sendButtonActive]} onPress={handleSend}>
            <Send size={18} color={message.trim() ? '#fff' : '#444'} />
          </Pressable>
        </BlurView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  backButton: { padding: 8, marginLeft: -8 },
  headerTextContainer: { flex: 1, marginLeft: 8 },
  headerSubtitle: { color: '#10b981', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  loaderCenter: { flex: 1, justifyContent: 'center' },
  chatArea: { padding: 16, paddingBottom: 30 },
  messageWrapper: { marginBottom: 16, maxWidth: '85%' },
  messageWrapperMe: { alignSelf: 'flex-end' },
  messageWrapperThem: { alignSelf: 'flex-start' },
  messageBubble: { padding: 12, borderRadius: 18 },
  messageBubbleMe: { backgroundColor: '#10b981', borderBottomRightRadius: 2 },
  messageBubbleThem: { backgroundColor: '#1C1C1E', borderBottomLeftRadius: 2 },
  messageText: { color: '#fff', fontSize: 16, lineHeight: 21 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  messageFooterMe: { justifyContent: 'flex-end' },
  messageFooterThem: { justifyContent: 'flex-start' },
  timeText: { color: '#666', fontSize: 10, fontWeight: '600' },
  readReceipt: { marginLeft: 4 },
  typingContainer: { alignSelf: 'flex-start', marginBottom: 16 },
  typingBubble: { backgroundColor: '#1C1C1E', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 18, borderBottomLeftRadius: 2, flexDirection: 'row', alignItems: 'center' },
  typingDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#86868b', marginHorizontal: 2 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 35 : 15 },
  attachButton: { padding: 10 },
  textInput: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 22, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, color: '#fff', fontSize: 16, marginHorizontal: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  sendButtonActive: { backgroundColor: '#10b981' },
});
