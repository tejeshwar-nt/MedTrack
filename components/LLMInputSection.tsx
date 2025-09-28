import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Alert, ActionSheetIOS } from 'react-native';
import { saveImageRecord, saveTextRecord, uploadImage, uploadAudio, saveVoiceRecord, transcribeAndAttachLlmText, describeAndAttachLlmText, generateAndAttachFollowUpsForText, subscribeToFollowUps, setFollowUpResponse } from '../services/records';
import { auth } from '../config/firebase';

type MessageType = 'text' | 'image' | 'voice';
type Role = 'assistant' | 'user';

type Message = {
  id: string;
  role: Role;
  type: MessageType;
  content?: string;
  imageUri?: string;
  audioUri?: string;
  audioDurationSec?: number;
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
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingVoiceUri, setPendingVoiceUri] = useState<string | null>(null);
  const [voiceDurationMs, setVoiceDurationMs] = useState<number | null>(null);
  const [waveTick, setWaveTick] = useState(0);
  const [amp, setAmp] = useState(0); // 0..1 voice amplitude
  const waveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [progress, setProgress] = useState<{ position: number; duration: number }>({ position: 0, duration: 0 });
  const [pendingFollowUps, setPendingFollowUps] = useState<{ recordId: string; questions: { index: number; text: string }[] } | null>(null);
  const followUpUnsubRef = useRef<null | (() => void)>(null);
  const hadFollowUpsRef = useRef(false);

  useEffect(() => {
    if (!isRecording) return;
    if (waveTimerRef.current) clearInterval(waveTimerRef.current as any);
    waveTimerRef.current = setInterval(async () => {
      setWaveTick(t => t + 1);
      try {
        if (recording) {
          const st: any = await recording.getStatusAsync();
          const metering = st?.metering; // iOS only
          if (typeof metering === 'number') {
            // Convert dBFS (-160..0) to 0..1
            const norm = Math.max(0, Math.min(1, 1 - (Math.abs(metering) / 160)));
            const thresholded = norm < 0.05 ? 0 : norm; // no amplification when silent
            setAmp(thresholded);
          } else {
            // No metering -> keep wave flat
            setAmp(0);
          }
        }
      } catch {}
    }, 80);
    return () => {
      if (waveTimerRef.current) clearInterval(waveTimerRef.current as any);
      waveTimerRef.current = null;
    };
  }, [isRecording, recording]);

  useEffect(() => {
    return () => { sound?.unloadAsync().catch(() => {}); };
  }, [sound]);

  async function togglePlayMessage(msg: Message) {
    try {
      if (!msg.audioUri) return;
      if (playingId === msg.id && sound) {
        const status = await sound.getStatusAsync();
        if ((status as any).isPlaying) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
        return;
      }
      // load new
      if (sound) {
        try { await sound.unloadAsync(); } catch {}
      }
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: msg.audioUri }, { shouldPlay: true });
      newSound.setOnPlaybackStatusUpdate((s: any) => {
        if (!s?.isLoaded) return;
        setProgress({ position: s.positionMillis ?? 0, duration: s.durationMillis ?? Math.max(1, s.positionMillis ?? 1) });
        if (s.didJustFinish) {
          setPlayingId(null);
        }
      });
      setSound(newSound);
      setPlayingId(msg.id);
    } catch (e) {
      console.warn('[voice] play error', e);
    }
  }
  const scrollRef = useRef<ScrollView>(null);

  const followUpActive = useMemo(() => !!pendingFollowUps, [pendingFollowUps]);

  const canSend = useMemo(() => {
    if (followUpActive) return text.trim().length > 0;
    if (mode === 'text') return text.trim().length > 0;
    if (mode === 'image') return !!pendingImageUri && imageUrl.trim().length > 0;
    if (mode === 'voice') return !!pendingVoiceUri; // require a captured clip
    return false;
  }, [followUpActive, mode, text, imageUrl, pendingImageUri, pendingVoiceUri]);

  async function handleSend() {
    if (followUpActive && pendingFollowUps && pendingFollowUps.questions.length > 0) {
      const current = pendingFollowUps.questions[0];
      const answer = text.trim();
      if (answer.length === 0) return;
      // Show the user's answer in chat
      setMessages(prev => [...prev, { id: `fu-ans-${pendingFollowUps.recordId}-${current.index}`, role: 'user', type: 'text', content: answer }]);
      setText('');
      try {
        await setFollowUpResponse(pendingFollowUps.recordId, current.index, answer);
      } catch (e) {
        console.warn('[followUps] failed to save response', e);
      }
      // Remove the answered question and move to the next
      setPendingFollowUps(prev => {
        if (!prev) return prev;
        const rest = prev.questions.slice(1);
        return rest.length > 0 ? { recordId: prev.recordId, questions: rest } : null;
      });
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
      return;
    }
    const id = String(Date.now());
    if (mode === 'text') {
      const userText = text.trim();
      setMessages(prev => [...prev, { id, role: 'user', type: 'text', content: userText }]);
      setText('');
      try {
        const saved = await saveTextRecord(userText);
        console.log('[records] text saved', saved.id);
        // Fire-and-forget follow-up generation
        generateAndAttachFollowUpsForText(saved.id!, userText);
        // Subscribe to follow-ups to pose them when ready
        followUpUnsubRef.current?.();
        followUpUnsubRef.current = subscribeToFollowUps(saved.id!, (fu) => {
          if (!fu || fu.length === 0) return;
          const questions = fu.map((q, i) => ({ index: i, text: q.question })).filter(q => !!q.text);
          if (questions.length > 0) {
            setPendingFollowUps({ recordId: saved.id!, questions });
          }
        });
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
          // Include the user's description along with the LLM-generated description
          describeAndAttachLlmText(saved.id!, url, userText);
          // Subscribe for follow-ups for this image record
          followUpUnsubRef.current?.();
          followUpUnsubRef.current = subscribeToFollowUps(saved.id!, (fu) => {
            if (!fu || fu.length === 0) return;
            const questions = fu.map((q, i) => ({ index: i, text: q.question })).filter(q => !!q.text);
            if (questions.length > 0) setPendingFollowUps({ recordId: saved.id!, questions });
          });
        } catch (e: any) {
          console.warn('[records] failed to save image', e);
          Alert.alert('Upload failed', e?.message ?? 'Could not upload your image. Check your connection and try again.');
        } finally {
          // Return to text mode so typing enables Send again
          setMode('text');
        }
      }
    } else {
      // voice mode
      const uri = pendingVoiceUri;
      if (!uri) return;
      // Derive duration: if not from state, probe from the file again as fallback
      let durationSec = Math.round((voiceDurationMs ?? 0) / 1000);
      if (!durationSec || durationSec < 1) {
        try {
          const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
          const st: any = await sound.getStatusAsync();
          durationSec = Math.max(1, Math.round(((st?.durationMillis ?? 0) / 1000)));
          await sound.unloadAsync();
        } catch {
          durationSec = Math.max(1, durationSec);
        }
      }
      setMessages(prev => [...prev, { id, role: 'user', type: 'voice', content: voiceLabel, audioUri: uri, audioDurationSec: durationSec }]);
      try {
        const url = await uploadAudio(uri, 'audio');
        const saved = await saveVoiceRecord(url, durationSec);
        console.log('[records] voice uploaded', url, 'saved', saved.id);
        // Fire-and-forget transcription job
        transcribeAndAttachLlmText(saved.id!, url);
        // Subscribe for follow-ups for this voice record
        followUpUnsubRef.current?.();
        followUpUnsubRef.current = subscribeToFollowUps(saved.id!, (fu) => {
          if (!fu || fu.length === 0) return;
          const questions = fu.map((q, i) => ({ index: i, text: q.question })).filter(q => !!q.text);
          if (questions.length > 0) setPendingFollowUps({ recordId: saved.id!, questions });
        });
        // update message uri to remote url
        setMessages(prev => prev.map(m => (m.id === id ? { ...m, audioUri: url } : m)));
      } catch (e: any) {
        console.warn('[records] failed to save voice', e);
        Alert.alert('Upload failed', e?.message ?? 'Could not upload your voice note.');
      } finally {
        setPendingVoiceUri(null);
        setVoiceDurationMs(null);
        setMode('text');
      }
    }
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }

  // When there are pending follow-ups, pose them one by one.
  useEffect(() => {
    if (!pendingFollowUps || pendingFollowUps.questions.length === 0) return;
    // If the last message isn't the current question, append it.
    const current = pendingFollowUps.questions[0];
    const last = messages[messages.length - 1];
    if (!last || last.type !== 'text' || last.role !== 'assistant' || last.content !== current.text) {
      setMessages(prev => [...prev, { id: `fu-${pendingFollowUps.recordId}-${current.index}`, role: 'assistant', type: 'text', content: current.text }]);
    }
  }, [pendingFollowUps, messages]);

  // Follow-up answers are now handled via handleSend using the main composer

  // Detect when follow-ups end to thank the user and cleanup
  useEffect(() => {
    if (pendingFollowUps && pendingFollowUps.questions.length > 0) {
      hadFollowUpsRef.current = true;
      return;
    }
    if (!pendingFollowUps && hadFollowUpsRef.current) {
      hadFollowUpsRef.current = false;
      followUpUnsubRef.current?.();
      followUpUnsubRef.current = null;
      setMessages(prev => [...prev, { id: `fu-thanks-${Date.now()}`, role: 'assistant', type: 'text', content: 'Thanks for sharing how you’re feeling today. You can continue with another report anytime.' }]);
    }
  }, [pendingFollowUps]);

  async function toggleRecording() {
    if (followUpActive && !isRecording && !pendingVoiceUri) {
      Alert.alert('Please finish follow-ups', 'Answer the follow-up question before recording audio.');
      return;
    }
    try {
      if (!isRecording) {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission required', 'Please allow microphone access.');
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync({ ...(Audio.RecordingOptionsPresets.HIGH_QUALITY as any), isMeteringEnabled: true } as any);
        await rec.startAsync();
        setRecording(rec);
        setIsRecording(true);
        setMode('voice');
      } else {
        if (!recording) return;
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        let status: any = null;
        try { status = await recording.getStatusAsync(); } catch {}
        setIsRecording(false);
        setRecording(null);
        if (uri) {
          // Prefer duration from recording status; if missing, probe via Audio.Sound
          let durationMs: number | null = (status && typeof status.durationMillis === 'number') ? status.durationMillis : null;
          if (!durationMs) {
            try {
              const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
              const s: any = await sound.getStatusAsync();
              if (s && typeof s.durationMillis === 'number') durationMs = s.durationMillis;
              await sound.unloadAsync();
            } catch {}
          }
          setPendingVoiceUri(uri);
          setVoiceDurationMs(durationMs);
          if (!voiceLabel) setVoiceLabel('Voice note');
        }
      }
    } catch (e) {
      console.warn('[voice] recording error', e);
      setIsRecording(false);
      setRecording(null);
    }
  }

  function discardVoice() {
    setPendingVoiceUri(null);
    setVoiceDurationMs(null);
    setIsRecording(false);
    setMode('text');
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
    if (followUpActive) {
      Alert.alert('Please finish follow-ups', 'Answer the follow-up question before adding images.');
      return;
    }
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
                ) : msg.type === 'voice' && !!msg.audioUri ? (
                  <View style={styles.voiceBubble}>
                    <Pressable onPress={() => togglePlayMessage(msg)} style={styles.playBtn}>
                      <Feather name={playingId === msg.id ? 'pause' : 'play'} size={18} color="#111" />
                    </Pressable>
                    <View style={styles.progressRail}>
                      <View style={[styles.progressFill, { width: `${Math.min(100, (progress.duration ? (progress.position / progress.duration) * 100 : 0))}%` }]} />
                    </View>
                    <Text style={styles.timeLabel}>
                      {playingId === msg.id ? `${Math.floor((progress.position || 0) / 1000)}s` : `${msg.audioDurationSec ?? 0}s`}
                    </Text>
                  </View>
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
              <Pressable accessibilityLabel="Add image" onPress={handleCameraPress} disabled={followUpActive} style={[styles.iconBtn, followUpActive && { opacity: 0.5 }]}>
                <Feather name="camera" size={18} color="#5c6b7a" />
              </Pressable>
              {mode === 'image' && pendingImageUri ? (
                <Image source={{ uri: pendingImageUri }} style={styles.thumb} />
              ) : null}
              {mode === 'voice' ? (
                <View style={[styles.voiceInlineContainer, { flex: 1 }]}> 
                  <View style={[styles.waveRail, isRecording && { opacity: 1 }]}> 
                    {Array.from({ length: 42 }).map((_, i) => { 
                      const phase = waveTick % 42; 
                      const k = Math.max(0, 1 - Math.abs(i - phase) / 8); 
                      const height = 4 + Math.round(18 * Math.max(0, Math.min(1, amp)) * k); 
                      const opacity = 0.35 + 0.65 * k; 
                      return <View key={i} style={[styles.waveDot, { height, opacity }]} />; 
                    })}
                  </View>
                </View>
              ) : (
                <TextInput
                  value={mode === 'text' ? text : mode === 'image' ? imageUrl : ''}
                  onChangeText={(v) => {
                    if (mode === 'text') setText(v);
                    else if (mode === 'image') setImageUrl(v);
                  }}
                  editable={true}
                  placeholder={mode === 'text' ? (followUpActive ? 'Type your answer…' : 'Write your message..') : mode === 'image' ? 'Add a short description…' : ''}
                  placeholderTextColor="#7a8591"
                  style={styles.inputInline}
                  multiline
                  blurOnSubmit={false}
                />
              )}
              <Pressable
                accessibilityLabel={pendingVoiceUri && !isRecording ? 'Discard voice' : 'Voice note'}
                onPress={pendingVoiceUri && !isRecording ? discardVoice : toggleRecording}
                disabled={followUpActive && !isRecording && !pendingVoiceUri}
                style={[styles.iconBtn, (isRecording || (pendingVoiceUri && !isRecording)) && { backgroundColor: isRecording ? '#ffd6d6' : '#ffe6e6' }, (followUpActive && !isRecording && !pendingVoiceUri) && { opacity: 0.5 }]}
              >
                <Feather name={pendingVoiceUri && !isRecording ? 'x' : (isRecording ? 'square' : 'mic')} size={18} color={isRecording ? '#d00' : '#5c6b7a'} />
              </Pressable>
              <Pressable accessibilityLabel="Send" onPress={handleSend} disabled={!canSend} style={[styles.iconBtn, styles.sendIconBtn, !canSend && { opacity: 0.5 }] }>
                <Feather name="send" size={18} color="#ffffff" />
              </Pressable>
            </View>
            {/* During follow-ups, the main composer field + Send act as the answer input */}
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
  voiceInlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    marginLeft: 8,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#5c6b7a',
    borderRadius: 2,
    marginHorizontal: 2,
  },
  waveRail: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingHorizontal: 10,
    flex: 1,
  },
  waveDot: {
    width: 3,
    backgroundColor: '#cfd4d9',
    borderRadius: 2,
    marginRight: 3,
  },
  voiceBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f5',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  playBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  progressRail: {
    width: 120,
    height: 4,
    backgroundColor: '#d7dde3',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#0b84ff',
  },
  timeLabel: { color: '#111', fontSize: 12 },
});


