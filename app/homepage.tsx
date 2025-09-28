import React, { useState } from 'react';
import {
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Alert,
  ScrollView,
  View,
  Text,
  Image,
} from 'react-native';
import { Link, useRouter, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';

/* --------------------
   Types
   -------------------- */
type TimelineItem = {
  id: string;
  type: 'image' | 'voice' | 'text';
  uri?: string;
  text?: string;
  createdAt: number;
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
    <View style={styles.timelineNodeGroup}>
      {/* Node Container (Circle) - is a Clickable Area */}
      <Pressable onPress={onOpen} style={styles.dayNodeCircle}>
        <View style={styles.dayNodeInner}>
          <Text style={styles.dayCount}>{day.items.length}</Text>
          
          {vis.length === 1 && (
            <View style={styles.iconSingleRow}>
              <Text style={styles.iconText}>{vis[0]}</Text>
            </View>
          )}

          {vis.length === 2 && (
            <View style={styles.iconTopRow}>
              <Text style={styles.iconText}>{vis[0]}</Text>
              <Text style={styles.iconText}>{vis[1]}</Text>
            </View>
          )}

          {vis.length >= 3 && (
            <>
              <View style={styles.iconTopRow}>
                <Text style={styles.iconText}>{vis[0]}</Text>
                <Text style={styles.iconText}>{vis[1]}</Text>
              </View>
              <View style={styles.iconBottomRow}>
                {extra > 0 ? (
                  <Text style={styles.iconPlus}>+{extra}</Text>
                ) : (
                  <Text style={styles.iconText}>{vis[2]}</Text>
                )}
              </View>
            </>
          )}
        </View>
      </Pressable>

      {/* Black dot on the horizontal timeline line */}
      <View style={styles.dayDot} />

      {/* Date below the dot in Month Abbreviation Day format */}
      <Text style={styles.dayFullDate}>{day.fullDate}</Text>
    </View>
  );
}

/* --------------------
   Full-screen expanded overlay (modal-like)
   -------------------- */
function ExpandedDayModal({ day, onClose }: { day: DayGroup; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const sorted = day.items.slice().sort((a, b) => a.createdAt - b.createdAt);

  return (
    <View style={modalStyles.overlay}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={modalStyles.modalSafe}>
        {/* Close X top-left */}
        <Pressable
          onPress={onClose}
          style={[modalStyles.closeBtn, { top: insets.top + 10, left: 12 }]}
          accessibilityLabel="Close"
        >
          <Text style={modalStyles.closeTxt}>✕</Text>
        </Pressable>

        {/* Header with full MM/DD/YYYY */}
        <View style={modalStyles.header}>
          <Text style={modalStyles.headerDate}>
            {new Date(day.dateKey).toLocaleDateString('en-US')}
          </Text>
        </View>

        {/* Body wrapper so we can position a full-height vertical line behind rows */}
        <View style={modalStyles.bodyWrapper}>
          {/* Full vertical line (spans the whole modal body) — sits behind node dots */}
          <View style={modalStyles.fullVerticalLine} />

          {/* Each interaction is its own row so time aligns exactly with its assets */}
          <ScrollView style={modalStyles.body} contentContainerStyle={{ paddingBottom: 48 }}>
            {sorted.map((it) => (
              <View key={it.id} style={modalStyles.interactionRow}>
                {/* Left: time */}
                <View style={modalStyles.timesColumn}>
                  <Text style={modalStyles.timeTextLarger}>
                    {new Date(it.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                {/* Middle: dot only (vertical line is behind all rows) */}
                <View style={modalStyles.connectorColumn}>
                  <View style={modalStyles.nodeDot} />
                </View>

                {/* Right: assets for THIS interaction - horizontal scroll if multiple assets */}
                <View style={modalStyles.assetsColumn}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ alignItems: 'flex-start', paddingVertical: 8 }}
                  >
                    {/* Image */}
                    {it.type === 'image' && it.uri ? (
                      <View style={modalStyles.assetCard}>
                        <Image source={{ uri: it.uri }} style={modalStyles.assetImage} />
                        {it.text ? <Text style={modalStyles.assetCaption}>{it.text}</Text> : null}
                      </View>
                    ) : null}

                    {/* Voice - placeholder */}
                    {it.type === 'voice' && it.uri ? (
                      <View style={modalStyles.assetCard}>
                        <View style={modalStyles.assetContent}>
                          <Text style={{ fontWeight: '700000' }}>🎙️ Voice recording</Text>
                          <Text style={{ color: '#666666', fontSize: 12 }}>{it.uri.split('/').pop()}</Text>
                        </View>
                      </View>
                    ) : null}

                    {/* Text asset */}
                    {it.type === 'text' && it.text ? (
                      <View style={modalStyles.assetCard}>
                        <ScrollView style={{ maxHeight: 360 }}>
                          <Text style={modalStyles.assetText}>{it.text}</Text>
                        </ScrollView>
                      </View>
                    ) : null}
                  </ScrollView>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
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

  // Render the patient UI if logged in & patient role
  if (user && profile?.role === 'patient') {
    return (
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
                    { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.push('/signin'); } },
                  ]);
                }}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={{ fontWeight: '700', color: '#0b84ff' }}>Sign Out</Text>
              </Pressable>
            ),
          }}
        />

        <SafeAreaView style={styles.safe}>
          <View style={styles.patientScreen}>
            <Text style={styles.welcomeTop}>
              Welcome back, {profile?.displayName || user.displayName || 'User'}!
            </Text>

            {/* TIMELINE (horizontal) */}
            <View style={styles.topHalf}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fullBleed} contentContainerStyle={styles.timelineScrollContent}>
                {/* Black line runs horizontally across the content */}
                <View style={styles.timelineCenterLineHorizontal} />

                {Object.values(groups).map((day) => (
                  <DayNode key={day.dateKey} day={day} onOpen={() => setExpandedDayId(day.dateKey)} />
                ))}
              </ScrollView>
            </View>

            <Text style={styles.sectionTitle}>Share how you're feeling today</Text>
            {/* InputSection (Media Input UI) */}
            <InputSection />

            {/* Full-screen overlay modal when expandedDayId is set */}
            {expandedDayId && groups[expandedDayId] && (
              <ExpandedDayModal day={groups[expandedDayId]} onClose={() => setExpandedDayId(null)} />
            )}
          </View>
        </SafeAreaView>
      </>
    );
  }

  //Same functionality as index.tsx so I jus ended up commenting out
  // Non-patient or not logged in UI (kept similar to your original)
  if (user) {
    // provider or other
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.screen}>
          <View style={styles.card}>
            <Text style={styles.logo}>MedTrak</Text>
            {profile ? (
              <>
                <Text style={styles.roleText}>Role: Healthcare Provider</Text>
                {profile.license && <Text style={styles.licenseText}>License: {profile.license}</Text>}
                <Text style={styles.emailText}>Email: {profile.email}</Text>
              </>
            ) : (
              <Text style={styles.roleText}>Loading profile...</Text>
            )}
            <Pressable
              style={({ pressed }) => [styles.signOutButton, pressed && styles.btnPressed]}
              onPress={() => {
                Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.push('/signin'); } },
                ]);
              }}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // not logged in
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.logo}>🔎 MedTrak</Text>
          <Text style={styles.question}>Are you a patient or a provider?</Text>

          <View style={[styles.buttonRow]}>
            <Link href="/signupPatient" asChild>
              <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}>
                <Text style={styles.primaryTxt}>I'm a Patient</Text>
              </Pressable>
            </Link>

            <Link href="/signupProvider" asChild>
              <Pressable style={({ pressed }) => [styles.outlineBtn, pressed && styles.btnPressed]}>
                <Text style={styles.outlineTxt}>I'm a Provider</Text>
              </Pressable>
            </Link>
          </View>

          <Text style={styles.small}>By continuing you agree to our Terms & Privacy.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
} 

/* --------------------
   InputSection (keeps your previous segmented UI)
   -------------------- */
function InputSection() {
  const [tab, setTab] = useState<'text' | 'image' | 'voice'>('text');

  return (
    <View style={styles.inputSection}>
      <View style={styles.segmentedContainer}>
        <Pressable onPress={() => setTab('text')} style={({ pressed }) => [styles.segment, tab === 'text' && styles.segmentActive, pressed && { opacity: 0.9 }]}>
          <Text style={[styles.segmentLabel, tab === 'text' && styles.segmentLabelActive]}>Text</Text>
        </Pressable>
        <View style={styles.segmentDivider} />
        <Pressable onPress={() => setTab('image')} style={({ pressed }) => [styles.segment, tab === 'image' && styles.segmentActive, pressed && { opacity: 0.9 }]}>
          <Text style={[styles.segmentLabel, tab === 'image' && styles.segmentLabelActive]}>Image</Text>
        </Pressable>
        <View style={styles.segmentDivider} />
        <Pressable onPress={() => setTab('voice')} style={({ pressed }) => [styles.segment, tab === 'voice' && styles.segmentActive, pressed && { opacity: 0.9 }]}>
          <Text style={[styles.segmentLabel, tab === 'voice' && styles.segmentLabelActive]}>Voice</Text>
        </Pressable>
      </View>

      <View style={styles.instructionsCard}>
        {tab === 'text' && <Text style={styles.instructionsText}>Please enter a brief description of your symptoms, concerns, or updates.</Text>}
        {tab === 'image' && <Text style={styles.instructionsText}>Upload clear photos relevant to your condition (e.g., a rash). Ensure good lighting.</Text>}
        {tab === 'voice' && <Text style={styles.instructionsText}>Record a short voice note describing your symptoms, timing, and any triggers.</Text>}
      </View>
    </View>
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
    paddingBottom: 32,
  },
  welcomeTop: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111',
    textAlign: 'left',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    textAlign: 'left',
    marginTop: 20,
    marginBottom: 0,
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
    paddingBottom: 20,
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
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    padding: 6,
    alignItems: 'center',
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
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
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
  primaryBtn: { flex: 1, height: 52, borderRadius: 26, borderWidth: 1, backgroundColor: '#0b84ff', alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  primaryTxt: { color: 'white', fontSize: 16, fontWeight: '600' },
  outlineBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: '#0b84ff', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
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
  headerDate: { fontSize: 18, fontWeight: '700', color: '#111' },

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
     The horizontal ScrollView contains asset cards that use alignSelf:'flex-start'. */
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
