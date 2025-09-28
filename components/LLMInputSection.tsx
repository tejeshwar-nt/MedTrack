import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, ActionSheetIOS } from 'react-native';
import { saveImageRecord, saveTextRecord, uploadImage } from '../services/records';
import { auth } from '../config/firebase';

type MessageType = 'text' | 'image' | 'voice';
type Role = 'assistant' | 'user';

type Message = {
  id: string;
  role: Role;
  type: MessageType;
  content?: string;
  imageUri?: string;
};

export default function LLMInputSection({ initialPrompt }: { initialPrompt: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'assistant', type: 'text', content: initialPrompt },
  ]);
  const [mode, setMode] = useState<MessageType>('text');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [voiceLabel, setVoiceLabel] = useState('Voice note (00:10)');
  const scrollRef = useRef<ScrollView>(null);

  const canSend = useMemo(() => {
    if (mode === 'text') return text.trim().length > 0;
    if (mode === 'image') return !!pendingImageUri && imageUrl.trim().length > 0;
    if (mode === 'voice') return true; // placeholder: always true when tapping add
    return false;
  }, [mode, text, imageUrl, pendingImageUri]);

  async function handleSend() {
    const id = String(Date.now());
    if (mode === 'text') {
      const userText = text.trim();
      setMessages(prev => [...prev, { id, role: 'user', type: 'text', content: userText }]);
      setText('');
      try {
        const saved = await saveTextRecord(userText);
        console.log('[records] text saved', saved.id);
      } catch (e: any) {
        console.warn('[records] failed to save text', e);
        Alert.alert('Save failed', e?.message ?? 'Could not save your note. Check your connection and try again.');
      }
    } else if (mode === 'image') {
      const userText = imageUrl.trim();
      const uri = pendingImageUri || '';
      setMessages(prev => [
        ...prev,
        { id, role: 'user', type: 'image', imageUri: uri, content: userText },
      ]);
      setImageUrl('');
      setPendingImageUri(null);
      // Upload and save
      if (uri) {
        try {
          const url = await uploadImage(uri, 'images');
          const saved = await saveImageRecord(url, userText);
          console.log('[records] image uploaded', url, 'saved', saved.id);
        } catch (e: any) {
          console.warn('[records] failed to save image', e);
          Alert.alert('Upload failed', e?.message ?? 'Could not upload your image. Check your connection and try again.');
        } finally {
          // Return to text mode so typing enables Send again
          setMode('text');
        }
      }
    } else {
      setMessages(prev => [...prev, { id, role: 'user', type: 'voice', content: voiceLabel }]);
    }
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }

  async function ensurePermissions() {
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    const granted = lib.status === 'granted' && cam.status === 'granted';
    if (!granted) {
      Alert.alert('Permission required', 'Please allow camera and photo library access.');
    }
    return granted;
  }

  async function openLibrary() {
    const ok = await ensurePermissions();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    console.log('[LLMInputSection] openLibrary result', result);
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setPendingImageUri(uri);
      setMode('image');
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }

  async function openCamera() {
    const ok = await ensurePermissions();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setPendingImageUri(uri);
      setMode('image');
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }

  function handleCameraPress() {
    // iOS action sheet; Android simple chooser
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) openCamera();
          if (idx === 2) openLibrary();
        }
      );
    } else {
      Alert.alert('Add Image', 'Select an option', [
        { text: 'Camera', onPress: openCamera },
        { text: 'Gallery', onPress: openLibrary },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80} style={{ flex: 1 }}>
      <View style={styles.wrapper}>
        <View style={styles.shadowLayer} />
        <View style={styles.card}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
          >
          {messages.map(msg => (
            <View key={msg.id} style={[styles.row, msg.role === 'assistant' ? styles.left : styles.right]}>
              <View style={[styles.bubble, msg.role === 'assistant' ? styles.assistantBubble : styles.userBubble]}>
                {msg.type === 'image' && !!msg.imageUri ? (
                  <>
                    <Image source={{ uri: msg.imageUri }} style={styles.image} resizeMode="cover" />
                    {!!msg.content && (
                      <Text style={[msg.role === 'assistant' ? styles.assistantText : styles.userText, { marginTop: 6 }]}>
                        {msg.content}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={msg.role === 'assistant' ? styles.assistantText : styles.userText}>
                    {msg.content}
                  </Text>
                )}
              </View>
            </View>
          ))}
          </ScrollView>

        {/* Composer */}
          <View style={styles.composer}>
            <View style={styles.capsule}>
              <Pressable accessibilityLabel="Add image" onPress={handleCameraPress} style={styles.iconBtn}>
                <Feather name="camera" size={18} color="#5c6b7a" />
              </Pressable>
              {mode === 'image' && pendingImageUri ? (
                <Image source={{ uri: pendingImageUri }} style={styles.thumb} />
              ) : null}
              <TextInput
                value={mode === 'text' ? text : mode === 'image' ? imageUrl : voiceLabel}
                onChangeText={(v) => {
                  if (mode === 'text') setText(v);
                  else if (mode === 'image') setImageUrl(v);
                  else setVoiceLabel(v);
                }}
                placeholder={mode === 'text' ? 'Write your message..' : mode === 'image' ? 'Add a short description…' : 'Record a short note..'}
                placeholderTextColor="#7a8591"
                style={styles.inputInline}
                multiline
                blurOnSubmit={false}
              />
              <Pressable accessibilityLabel="Voice note" onPress={() => setMode('voice')} style={styles.iconBtn}>
                <Feather name="mic" size={18} color="#5c6b7a" />
              </Pressable>
              <Pressable accessibilityLabel="Send" onPress={handleSend} disabled={!canSend} style={[styles.iconBtn, styles.sendIconBtn, !canSend && { opacity: 0.5 }] }>
                <Feather name="send" size={18} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 0,
  },
  shadowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
    elevation: 8,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  assistantBubble: { backgroundColor: '#f1f3f5' },
  userBubble: { backgroundColor: '#0b84ff' },
  assistantText: { color: '#111' },
  userText: { color: '#fff' },
  image: { width: 220, height: 140, borderRadius: 10 },
  thumb: { width: 32, height: 32, borderRadius: 6, marginHorizontal: 6, backgroundColor: '#ccd6dd' },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e6e9ee',
    padding: 12,
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: '#e9eef3',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dde5ec',
    marginHorizontal: 4,
  },
  sendIconBtn: {
    backgroundColor: '#0b84ff',
  },
  inputInline: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: '#111',
    maxHeight: 100,
  },
  sendBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#0b84ff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  sendLabel: { color: '#fff', fontWeight: '700' },
});


