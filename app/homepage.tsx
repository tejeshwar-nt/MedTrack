import React, { useEffect, useState } from 'react';
import { StyleSheet, Pressable, View as RNView, useWindowDimensions, Alert, ScrollView, View, Text, KeyboardAvoidingView, Platform, Image, } from 'react-native';
import { Link, useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useAuth } from '../hooks/useAuth';
import LLMInputSection from '../components/LLMInputSection';
import { fetchRecordsGroupedByDay } from '../services/records';
import { AnyRecord } from '../models/record';
import { Audio } from 'expo-av';
import { Feather } from '@expo/vector-icons';

/* --------------------
   Types
   -------------------- */
type TimelineItem = {
  id: string;
  type: 'image' | 'voice' | 'text';
  uri?: string;
  text?: string;
  createdAt: number;
  audioDurationSec?: number;
};

type DayGroup = {
  dateKey: string; // YYYY-MM-DD
  dateLabel: string; // e.g. "Sep 27"
  fullDate: string; // Month abbreviation date format (e.g., "Sep 27")
  items: TimelineItem[];
};

/* --------------------
   Helpers
   -------------------- */
function groupByDay(items: TimelineItem[]): Record<string, DayGroup> {
  return items.reduce((acc: Record<string, DayGroup>, it) => {
    const d = new Date(it.createdAt);
    const dateKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
    const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    // Updated: fullDate now uses "Month abbreviation date" format (e.g., "Sep 27")
    const fullDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    if (!acc[dateKey]) acc[dateKey] = { dateKey, dateLabel, fullDate, items: [] };
    acc[dateKey].items.push(it);
    return acc;
  }, {});
}

function assetIconForType(type: TimelineItem['type']) {
  if (type === 'image') return '🖼️';
  if (type === 'voice') return '🎤';
  return '📝';
}

/* --------------------
   Compact Day Node (timeline)
   -------------------- */
function DayNode({ day, onOpen }: { day: DayGroup; onOpen: () => void }) {
  const counts = day.items.reduce<Record<string, number>>((acc, it) => {
    acc[it.type] = (acc[it.type] || 0) + 1;
    return acc;
  }, {});

  const icons = Object.keys(counts).map((t) => assetIconForType(t as any));
  const maxVis = 3;
  const vis = icons.slice(0, maxVis);
  const extra = Math.max(0, icons.length - maxVis);

  return (
    <RNView style={styles.timelineNodeGroup}>
      {/* Node Container (Circle) - is a Clickable Area */}
      <Pressable onPress={onOpen} style={styles.dayNodeCircle}>
        <RNView style={styles.dayNodeInner}>
          <Text style={styles.dayCount}>{day.items.length}</Text>
          
          {vis.length === 1 && (
            <RNView style={styles.iconSingleRow}>
              <Text style={styles.iconText}>{vis[0]}</Text>
            </RNView>
          )}

          {vis.length === 2 && (
            <RNView style={styles.iconTopRow}>
              <Text style={styles.iconText}>{vis[0]}</Text>
              <Text style={styles.iconText}>{vis[1]}</Text>
            </RNView>
          )}

          {vis.length >= 3 && (
            <>
              <RNView style={styles.iconTopRow}>
                <Text style={styles.iconText}>{vis[0]}</Text>
                <Text style={styles.iconText}>{vis[1]}</Text>
              </RNView>
              <RNView style={styles.iconBottomRow}>
                {extra > 0 ? (
                  <Text style={styles.iconPlus}>+{extra}</Text>
                ) : (
                  <Text style={styles.iconText}>{vis[2]}</Text>
                )}
              </RNView>
            </>
          )}
        </RNView>
      </Pressable>

      {/* Black dot on the horizontal timeline line */}
      <RNView style={styles.dayDot} />

      {/* Date below the dot in Month Abbreviation Day format */}
      <Text style={styles.dayFullDate}>{day.fullDate}</Text>
    </RNView>
  );
}

/* --------------------
   Full-screen expanded overlay (modal-like)
   -------------------- */
function ExpandedDayModal({ day, onClose }: { day: DayGroup; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const sorted = day.items.slice().sort((a, b) => a.createdAt - b.createdAt);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ position: number; duration: number }>({ position: 0, duration: 0 });

  useEffect(() => {
    return () => {
      sound?.unloadAsync().catch(() => {});
    };
  }, [sound]);

  async function togglePlay(item: TimelineItem) {
    if (!item.uri) return;
    try {
      if (playingId === item.id && sound) {
        const st = await sound.getStatusAsync() as any;
        if (st?.isPlaying) await sound.pauseAsync(); else await sound.playAsync();
        return;
      }
      if (sound) {
        try { await sound.unloadAsync(); } catch {}
      }
      const { sound: newSound } = await Audio.Sound.createAsync({ uri: item.uri }, { shouldPlay: true });
      newSound.setOnPlaybackStatusUpdate((s: any) => {
        if (!s?.isLoaded) return;
        setProgress({ position: s.positionMillis ?? 0, duration: s.durationMillis ?? Math.max(1, s.positionMillis ?? 1) });
        if (s.didJustFinish) setPlayingId(null);
      });
      setSound(newSound);
      setPlayingId(item.id);
    } catch (e) {
      console.warn('[timeline] play error', e);
    }
  }

  return (
    <RNView style={modalStyles.overlay}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={modalStyles.modalSafe}>
        {/* Close X top-left */}
        <Pressable
          onPress={onClose}
          style={[modalStyles.closeBtn, { top: insets.top + 10, left: 12 }]}
          accessibilityLabel="Close"
        >
          <Text style={modalStyles.closeTxt}>✕</Text>
        </Pressable>

        {/* Header with short date (e.g., "Sep 27") */}
        <RNView style={modalStyles.header}>
          <Text style={modalStyles.headerDate}>{day.fullDate}</Text>
        </RNView>

        {/* Body wrapper so we can position a full-height vertical line behind rows */}
        <RNView style={modalStyles.bodyWrapper}>
          {/* Full vertical line (spans the whole modal body) — sits behind node dots */}
          <RNView style={modalStyles.fullVerticalLine} />

          {/* Each interaction is its own row so time aligns exactly with its assets */}
          <ScrollView style={modalStyles.body} contentContainerStyle={{ paddingBottom: 48 }}>
            {sorted.map((it) => (
              <RNView key={it.id} style={modalStyles.interactionRow}>
                {/* Left: time */}
                <RNView style={modalStyles.timesColumn}>
                  <Text style={modalStyles.timeTextLarger}>
                    {new Date(it.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </RNView>

                {/* Middle: dot only (vertical line is behind all rows) */}
                <RNView style={modalStyles.connectorColumn}>
                  <RNView style={modalStyles.nodeDot} />
                </RNView>

                {/* Right: assets for THIS interaction - horizontal scroll if multiple assets */}
                <RNView style={modalStyles.assetsColumn}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ alignItems: 'flex-start', paddingVertical: 8 }}
                  >
                    {/* Image */}
                    {it.type === 'image' && it.uri ? (
                      <RNView style={modalStyles.assetCard}>
                        <Image source={{ uri: it.uri }} style={modalStyles.assetImage} />
                        {it.text ? <Text style={modalStyles.assetCaption}>{it.text}</Text> : null}
                      </RNView>
                    ) : null}

                    {/* Voice - playable */}
                    {it.type === 'voice' && it.uri ? (
                      <RNView style={[modalStyles.assetCard, { flexDirection: 'row', alignItems: 'center' }]}> 
                        <Pressable onPress={() => togglePlay(it)} style={styles.playBtn} accessibilityLabel="Play voice note">
                          <Feather name={playingId === it.id ? 'pause' : 'play'} size={18} color="#111" />
                        </Pressable>
                        <RNView style={styles.progressRail}>
                          <RNView style={[styles.progressFill, { width: `${Math.min(100, (progress.duration ? (progress.position / progress.duration) * 100 : 0))}%` }]} />
                        </RNView>
                        <Text style={styles.timeLabel}>{playingId === it.id ? `${Math.floor((progress.position || 0)/1000)}s` : `${it.audioDurationSec ?? 0}s`}</Text>
                      </RNView>
                    ) : null}

                {/* Text asset - auto height (no fixed max height) */}
                {it.type === 'text' && it.text ? (
                  <RNView style={modalStyles.assetCard}>
                    <Text style={modalStyles.assetText}>{it.text}</Text>
                  </RNView>
                ) : null}
                  </ScrollView>
                </RNView>
              </RNView>
            ))}
          </ScrollView>
        </RNView>
      </SafeAreaView>
    </RNView>
  );
}

/* --------------------
   Main screen
   -------------------- */
export default function HomePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 420;
  const { user, profile, signOut } = useAuth();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  // Track current patient id at top of page; required param for this view.
  // If not provided, fall back to signed-in user's uid (e.g., provider viewing their own data).
  const [currentpatientId, setCurrentpatientId] = useState<string | null>(
    (typeof params.currentpatientId === 'string' && params.currentpatientId.trim().length > 0)
      ? params.currentpatientId
      : (user?.uid ?? null)
  );

  // Dictionary of records grouped by day
  const [recordsByDay, setRecordsByDay] = useState<Record<string, AnyRecord[]>>({});

  // If a provider is accessing, force currentpatientId to their own uid.
  useEffect(() => {
    if (profile?.role === 'provider' && user?.uid) {
      if (currentpatientId !== user.uid) setCurrentpatientId(user.uid);
    } else if (!currentpatientId && user?.uid) {
      setCurrentpatientId(user.uid);
    }
  }, [profile?.role, user?.uid]);

  useEffect(() => {
    (async () => {
      try {
        if (!currentpatientId) return;
        const data = await fetchRecordsGroupedByDay(currentpatientId);
        console.log('[homepage] fetched recordsByDay for', currentpatientId, data);
        setRecordsByDay(data);
        // Build timeline items from fetched records (flatten + sort by createdAt)
        const combined: TimelineItem[] = [];
        Object.keys(data).forEach((dayKey) => {
          const recs = data[dayKey] as AnyRecord[];
          recs.forEach((r, idx) => {
            const createdAt = typeof (r as any).createdAt === 'number' ? (r as any).createdAt : Date.now();
            if ((r as any).kind === 'image') {
              const imageUrl = (r as any).imageUrl || undefined;
              const text = (r as any).llmText ?? (r as any).userText ?? undefined;
              combined.push({ id: (r as any).id ?? `img-${idx}-${createdAt}`, type: 'image', uri: imageUrl, text, createdAt });
            } else if ((r as any).kind === 'voice') {
              const audioUrl = (r as any).audioUrl || undefined;
              const text = (r as any).llmText ?? undefined;
              const audioDurationSec = (r as any).audioDurationSec ?? undefined;
              combined.push({ id: (r as any).id ?? `voice-${idx}-${createdAt}`, type: 'voice', uri: audioUrl, text, createdAt, audioDurationSec });
            } else {
              const text = (r as any).userText ?? (r as any).llmText ?? '';
              combined.push({ id: (r as any).id ?? `text-${idx}-${createdAt}`, type: 'text', text, createdAt });
            }
          });
        });
        combined.sort((a, b) => a.createdAt - b.createdAt);
        setTimeline(combined);
      } catch (e) {
        console.warn('[homepage] failed to fetch grouped records', e);
      }
    })();
  }, [currentpatientId]);

  // sample timeline (replace with your data fetch)
  const [timeline, setTimeline] = useState<TimelineItem[]>([
    // Group 1: 3 days ago (MM/DD/YYYY format in display)
    { id: '1', type: 'image', uri: 'https://picsum.photos/300/200?1', text: 'Rash evolution, day 1.', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3 },
    { id: '2', type: 'text', text: 'Feeling slightly better than yesterday.', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 30 },
    // Group 2: 1 day ago
    { id: '3', type: 'voice', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', text: 'Coughing fit at 9 AM.', createdAt: Date.now() - 1000 * 60 * 60 * 24 },
    { id: '4', type: 'text', text: 'Temperature check: 99.8°F', createdAt: Date.now() - 1000 * 60 * 60 * 24 + 1000 * 60 * 45 },
    // Group 3: Today
    { id: '5', type: 'image', uri: 'https://picsum.photos/300/200?5', text: 'New photo of left arm.', createdAt: Date.now() - 1000 * 60 * 60 * 2 },
        { id: '5', type: 'image', uri: 'https://picsum.photos/300/200?5', text: 'New photo of left arm.', createdAt: Date.now() - 1000 * 60 * 60 * 2 },
    { id: '6', type: 'image', uri: 'https://picsum.photos/300/200?5', text: 'New photo of left arm.', createdAt: Date.now() - 1000 * 60 * 60 * 2 },
    { id: '7', type: 'image', uri: 'https://picsum.photos/300/200?5', text: 'New photo of left arm.', createdAt: Date.now() - 1000 * 60 * 60 * 2 },
    { id: '8', type: 'image', uri: 'https://picsum.photos/300/200?5', text: 'New photo of left arm.', createdAt: Date.now() - 1000 * 60 * 60 * 2 },
    { id: '9', type: 'image', uri: 'https://picsum.photos/300/200?5', text: 'New photo of left arm.', createdAt: Date.now() - 1000 * 60 * 60 * 2 },
    { id: '10', type: 'image', uri: 'https://picsum.photos/300/200?5', text: 'New photo of left arm.', createdAt: Date.now() - 1000 * 60 * 60 * 2 },
    { id: '11', type: 'image', uri: 'https://picsum.photos/300/200?5', text: 'New photo of left arm.', createdAt: Date.now() - 1000 * 60 * 60 * 2 },
  ]);

  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const groups = groupByDay(timeline); // keyed groups

  let content: React.ReactNode = null;

  // Render the patient UI if logged in & patient role
  if (user && profile?.role === 'patient') {
    content = (
      <>
        <Stack.Screen
          options={{
            headerTitle: '',
            headerBackVisible: false,
            headerRight: () => (
              <Pressable
                onPress={() => {
                  Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Out', style: 'destructive', onPress: async () => { try { await signOut(); router.replace('/signin');
                    } catch (e) {
                      console.error('Sign out failed', e);
                    }
                  }},
                  ]);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={{ fontWeight: '700', color: '#0b84ff' }}>Sign Out</Text>
              </Pressable>
            ),
          }}
        />

        <SafeAreaView edges={['left','right','bottom']} style={styles.safe}>
          <RNView style={[styles.patientScreen, { paddingTop: Math.max(12, Math.floor(insets.top * 0.4)) }]}>
            <Text style={styles.welcomeTop}>
              Welcome back, {profile?.displayName || user.displayName || 'User'}!
            </Text>

            {/* TIMELINE (horizontal) */}
            <RNView style={styles.topHalf}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fullBleed} contentContainerStyle={styles.timelineScrollContent}>
                {/* Black line runs horizontally across the content */}
                <RNView style={styles.timelineCenterLineHorizontal} />

                {Object.values(groups).map((day) => (
                  <DayNode key={day.dateKey} day={day} onOpen={() => setExpandedDayId(day.dateKey)} />
                ))}
              </ScrollView>
            </RNView>

            <Text style={styles.sectionTitle}>Share how you're feeling today</Text>
            {/* InputSection (Media Input UI) */}
            <LLMInputSection initialPrompt="Please enter a brief description of your symptoms, concerns, or updates." />

            {/* Full-screen overlay modal when expandedDayId is set */}
            {expandedDayId && groups[expandedDayId] && (
              <ExpandedDayModal day={groups[expandedDayId]} onClose={() => setExpandedDayId(null)} />
            )}
          </RNView>
        </SafeAreaView>
      </>
    );
  } else if (user) {
    // Provider or any non-patient, logged-in UI: show only the timeline
    content = (
      <>
        <Stack.Screen
          options={{
            headerTitle: '',
            headerBackVisible: false,
            headerRight: () => (
              <Pressable
                onPress={() => {
                  Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/'); } },
                  ]);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={{ fontWeight: '700', color: '#0b84ff' }}>Sign Out</Text>
              </Pressable>
            ),
          }}
        />
        <SafeAreaView edges={['left','right','bottom']} style={styles.safe}>
          <RNView style={[styles.patientScreen, { paddingTop: Math.max(12, Math.floor(insets.top * 0.5)) }]}>
            <Text style={styles.welcomeTop}>
              Welcome back, {profile?.displayName || user.displayName || 'User'}!
            </Text>
            <RNView style={styles.topHalf}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fullBleed} contentContainerStyle={styles.timelineScrollContent}>
                <RNView style={styles.timelineCenterLineHorizontal} />
                {Object.values(groups).map((day) => (
                  <DayNode key={day.dateKey} day={day} onOpen={() => setExpandedDayId(day.dateKey)} />
                ))}
              </ScrollView>
            </RNView>
            {expandedDayId && groups[expandedDayId] && (
              <ExpandedDayModal day={groups[expandedDayId]} onClose={() => setExpandedDayId(null)} />
            )}
          </RNView>
        </SafeAreaView>
      </>
    );
  } else {
    // not logged in
    content = (
      <SafeAreaView edges={['left','right','bottom']} style={styles.safe}>
        <RNView style={styles.screen}>
          <RNView style={styles.card}>
          <Text style={styles.question}>Are you a patient or a provider?</Text>

          <RNView style={styles.buttonRow}>
            <Pressable
              onPress={() => router.push('/signupPatient')}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.primaryTxt}>I'm a Patient</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/signupProvider')}
              style={({ pressed }) => [styles.outlineBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.outlineTxt}>I'm a Provider</Text>
            </Pressable>
          </RNView>
          <Text style={styles.small}>By continuing you agree to our Terms & Privacy.</Text>
          </RNView>
        </RNView>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={headerHeight} style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      {content}
    </KeyboardAvoidingView>
  );
} 

/* --------------------
   Styles (main + modal)
   -------------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F5' },

  patientScreen: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 8,
  },
  welcomeTop: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111',
    textAlign: 'left',
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    textAlign: 'left',
    marginTop: 8,
    marginBottom: 14,
    paddingHorizontal: 20,
  },

  topHalf: {
    height: 160, // Fixed height for timeline visibility
    marginBottom: 10,
  },
  fullBleed: {
    flex: 1,
  },

  // --- Timeline Specific Styles (UPDATED) ---
  timelineScrollContent: {
    paddingHorizontal: 12,
    alignItems: 'flex-start', // Align content to the top
    paddingTop: 25,
    paddingBottom: 10,
  },
  timelineCenterLineHorizontal: {
    position: 'absolute',
    height: 3, // Black line below nodes
    backgroundColor: '#111', // Black
    left: 0,
    right: 0,
    top: 115, // Positioned below the circle nodes
    zIndex: 0,
  },
    /* Icon layout inside the circle */
  iconSingleRow: {
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTopRow: {
    marginTop: 6,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around', // space icons across the width
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  iconBottomRow: {
    marginTop: 2,
    width: '100%',
    alignItems: 'center', // center the single bottom icon / +N
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 14, // slightly smaller so 3 emojis fit comfortably
    lineHeight: 18,
  },
  iconPlus: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0b4f8a',
    backgroundColor: 'rgba(11,132,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  timelineNodeGroup: {
    width: 100, // Width for each node grouping
    marginHorizontal: 16, // Increased spacing for date readability
    alignItems: 'center',
    position: 'relative',
    paddingTop: 8,
  },
  dayNodeCircle: {
    width: 70, // Smaller circle
    height: 70, // Smaller circle
    borderRadius: 35, // Perfect circle
    backgroundColor: '#e6f7ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b84ff',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
    zIndex: 2,
    borderWidth: 3,
    borderColor: '#fff', // White border for pop
    marginBottom: 10, // Space below the circle
  },
  dayNodeInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCount: { fontSize: 18, fontWeight: '900', color: '#0b4f8a' },
  dayIcons: { marginTop: 4, fontSize: 16 },
  
  dayDot: { // Black dot on the timeline line
    position: 'absolute',
    top: 86, // Aligned with the horizontal line
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111', // Black
    zIndex: 1,
  },
  dayFullDate: { 
    marginTop: 20, // Space below the black dot
    fontSize: 17, 
    color: '#333',
    fontWeight: '600',
  },
  // --- END Timeline Specific Styles ---

  inputSection: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 12,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    padding: 6,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  segment: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  segmentLabel: {
    color: '#333',
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: '#111',
  },
  segmentDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#ddd',
    marginHorizontal: 6,
  },
  instructionsCard: {
    flex: 1,
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  instructionsWrapper: {
    flex: 1,
    marginTop: 0,
  },
  instructionsShadow: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 12,
    bottom: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    // iOS shadow
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
    // Android elevation
    elevation: 8,
  },
  instructionsScrollInner: {
    flex: 1,
  },
  instructionsContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 260,
  },
  instructionsText: {
    color: '#111',
  },

  // Default Auth/Provider styles (unchanged)
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, backgroundColor: '#F5F5F5' },
  card: { width: '100%', maxWidth: 520, height: '62%', minHeight: 420, paddingHorizontal: 28, paddingVertical: 36, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 22, elevation: 8 },
  logo: { fontSize: 36, fontWeight: '800', marginBottom: 12, textAlign: 'center', color: '#0b0b0b' },
  question: { fontSize: 18, color: '#333', marginBottom: 18, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', width: '100%', marginTop: 20, marginBottom: 12, justifyContent: 'space-around' },
  primaryBtn: { flex: 1, color: '#0b84ff', height: 52, borderRadius: 26, borderWidth: 0, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginHorizontal: 6},
  primaryTxt: { color: '#0b84ff', fontSize: 16, fontWeight: '600' },
  outlineBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: 'white', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  outlineTxt: { color: '#0b84ff', fontSize: 16, fontWeight: '600' },
  btnPressed: { opacity: 0.88 },
  small: { marginTop: 45, color: '#666', fontSize: 12, textAlign: 'center' },
  welcome: { fontSize: 24, fontWeight: '600', color: '#111', marginBottom: 16, textAlign: 'center' },
  roleText: { fontSize: 18, color: '#555', marginBottom: 8, textAlign: 'center' },
  licenseText: { fontSize: 16, color: '#777', marginBottom: 8, textAlign: 'center' },
  emailText: { fontSize: 16, color: '#777', marginBottom: 20, textAlign: 'center' },
  signOutButton: { backgroundColor: '#ff3b30', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center' },
  signOutText: { color: 'white', fontWeight: '600', fontSize: 16 },

  // asset card
  assetCard: {
    width: 260,
    minHeight: 140,
    backgroundColor: '#f7fbff',
    borderRadius: 10,
    marginRight: 12,
    padding: 8,
  },
  assetImage: { width: '100%', height: 120, borderRadius: 8, resizeMode: 'cover' },
  assetText: { color: '#111' },
  assetCaption: { marginTop: 8, color: '#444', fontSize: 13 },
  // Voice player styles reused from chat
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

/* Modal-specific styles (UPDATED) */
const modalStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    zIndex: 9999,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  closeBtn: {
    position: 'absolute',
    zIndex: 60,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  closeTxt: { fontSize: 20, color: '#111' },

  header: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  headerDate: { fontSize: 20, fontWeight: '800', color: '#111' },

  /* wrapper that lets us position fullVerticalLine absolutely inside it */
  bodyWrapper: {
    flex: 1,
    position: 'relative',
    paddingHorizontal: 12,
  },

  /* full vertical line that spans the modal body behind the node dots
     IMPORTANT: left offset should match timesColumn width + half connector column width.
     If your timesColumn/connector widths change, update 'left' accordingly. */
  fullVerticalLine: {
    position: 'absolute',
    top: 0,
    bottom: -34,
    left: 121,            // <-- tune this if your columns change (see note below)
    width: 2,
    backgroundColor: '#111',
    opacity: 0.12,
    zIndex: 0,
  },

  body: { flex: 1 },

  /* Each interaction row — no need for very tall fixed heights; keep reasonable spacing */
  interactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
    minHeight: 120, // ensures enough vertical space so assets & times won't collide
  },

  /* Left times column (fixed width so alignment is stable) */
  timesColumn: {
    width: 92,
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  timeTextLarger: {
    fontSize: 16,
    color: '#111',
    fontWeight: '700',
  },

  /* Connector column only holds the dot; the continuous vertical line is behind everything */
  connectorColumn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    zIndex: 2,
  },
  nodeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#111',
    zIndex: 3,
  },

  /* Right assets column: cards will size to content (no fixed width/height).
     The horizontal ScrollRNView contains asset cards that use alignSelf:'flex-start'. */
  assetsColumn: { flex: 1 },

  assetCard: {
    alignSelf: 'flex-start',   // let the card size to its content
    backgroundColor: '#f7fbff',
    borderRadius: 10,
    marginRight: 12,
    padding: 10,
    // allow cards to compress/expand naturally:
    maxWidth: 360,
    minWidth: 120,
  },

  /* Image sizing: use aspectRatio and maxWidth so image sizes naturally while keeping proportions */
  assetImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    resizeMode: 'cover',
    marginBottom: 8,
  },

  assetCaption: { marginTop: 6, color: '#444', fontSize: 12 },

  assetContent: { paddingVertical: 4 },
  assetText: { color: '#111', fontSize: 14 },
});
