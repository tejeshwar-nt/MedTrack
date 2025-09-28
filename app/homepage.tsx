import React, { useEffect, useState } from 'react';
import {doc, getDoc, orderBy} from 'firebase/firestore';
import {
  StyleSheet,
  Pressable,
  useWindowDimensions,
  Alert,
  ScrollView,
  View as RNView,
  Text,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Link, useRouter, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth'; // Assuming this hook provides user and profile
import { getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  DocumentData,
  QuerySnapshot,
} from 'firebase/firestore';

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
   PatientTimelineView (Component for Provider to view a patient's history)
   -------------------- */
function PatientTimelineView({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth(); // Ensures we have the logged-in user context

  const [patientProfile, setPatientProfile] = useState<DocumentData | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !patientId) return; // Must have user and patientId
    const db = getFirestore(getApp());

    // 1. Fetch patient profile once (using patientId/UID)
    // The patientId passed here is the patient's UID, which is used as the document ID in 'profiles'.
    const profileDocRef = doc(db, 'profiles', patientId);
    (async () => {
      try {
        const snap = await getDoc(profileDocRef);
        if (snap.exists()) setPatientProfile(snap.data());
        else setError('Patient profile not found.');
      } catch (e) {
        console.error('Error fetching profile', e);
        setError('Failed to load patient profile.');
      }
    })();

    // 2. Listen to timeline entries (real-time)
    // The patientId/UID is used to locate the subcollection of timeline entries.
    const timelineColRef = collection(db, 'patientTimelines', patientId, 'entries');
    
    // NOTE: orderBy('createdAt', 'desc') might require an index in Firestore.
    // If you encounter errors, remove orderBy and sort client-side.
    // However, keeping it as provided for now.
    const q = query(timelineColRef, orderBy('createdAt', 'desc')); 
    
    const unsub = onSnapshot(
      q,
      (snap) => {
        // Explicitly type the data structure from Firestore
        const items: TimelineItem[] = snap.docs.map((d) => ({ 
          id: d.id, 
          type: d.data().type,
          uri: d.data().uri,
          text: d.data().text,
          createdAt: d.data().createdAt,
        }));
        setTimeline(items);
        setLoading(false); // Set loading to false once the initial snapshot is received
      },
      (err) => {
        console.error('Timeline listener failed', err);
        setError('Failed to load patient timeline.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, patientId]); // Dependency on patientId ensures new patient loads when selected

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <RNView style={[styles.screen, { paddingTop: insets.top + 50 }]}>
          <ActivityIndicator size="large" color="#0b84ff" />
          <Text style={{ marginTop: 16 }}>Loading patient data...</Text>
        </RNView>
      </SafeAreaView>
    );
  }

  const patientName = patientProfile?.displayName ?? 'Patient';

  return (
    <SafeAreaView style={styles.safe}>
      <RNView style={styles.patientScreen}>
        <RNView style={styles.patientHeader}>
          {/* Back button to return to the patient list */}
          <Pressable onPress={onClose} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back to Patient List</Text>
          </Pressable>

          <Text style={styles.welcomeTop}>{patientName}'s Summary</Text>
          <Text style={styles.patientInfoText}>{patientProfile?.email ?? ''}</Text>
        </RNView>

        {error ? (
          <Text style={{ color: 'red', padding: 20 }}>{error}</Text>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
            <Text style={styles.sectionTitleTimeline}>Patient Timeline</Text>

            {/* Horizontal Timeline Overview */}
            {/*ADD HOOK HERE THAT FETCHES THEIR OWN TIMELINE DATA FROM FIRESTORE*/}
            {/*<RNView style={styles.topHalf}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fullBleed} contentContainerStyle={styles.timelineScrollContent}>
                <RNView style={styles.timelineCenterLineHorizontal} />
                {Object.values(groupByDay(timeline)).map((day) => (
                  <DayNode key={day.dateKey} day={day} onOpen={() => setExpandedDayId(day.dateKey)} />
                ))}
              </ScrollView>
            </RNView>
            */}
            {/* Expanded Day Modal */}
            {expandedDayId && groupByDay(timeline)[expandedDayId] && (
              <ExpandedDayModal day={groupByDay(timeline)[expandedDayId]} onClose={() => setExpandedDayId(null)} />
            )}
          </ScrollView>
        )}
      </RNView>
    </SafeAreaView>
  );
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
      <Text style={styles.sectionTitleTimeline}>Patient Timeline</Text>
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

      <RNView style={styles.dayDot} />
      <Text style={styles.dayFullDate}>{day.fullDate}</Text>
    </RNView>
  );
}

/* --------------------
   Full-screen expanded overlay (modal-like) - [UNCHANGED]
   -------------------- */
function ExpandedDayModal({ day, onClose }: { day: DayGroup; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const sorted = day.items.slice().sort((a, b) => a.createdAt - b.createdAt);

  return (
    <RNView style={modalStyles.overlay}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={modalStyles.modalSafe}>
        <Pressable
          onPress={onClose}
          style={[modalStyles.closeBtn, { top: insets.top + 10, left: 12 }]}
          accessibilityLabel="Close"
        >
          <Text style={modalStyles.closeTxt}>✕</Text>
        </Pressable>

        <RNView style={modalStyles.header}>
          <Text style={modalStyles.headerDate}>
            {new Date(day.dateKey).toLocaleDateString('en-US')}
          </Text>
        </RNView>

        <RNView style={modalStyles.bodyWrapper}>
          <RNView style={modalStyles.fullVerticalLine} />
          <ScrollView style={modalStyles.body} contentContainerStyle={{ paddingBottom: 48 }}>
            {sorted.map((it) => (
              <RNView key={it.id} style={modalStyles.interactionRow}>
                <RNView style={modalStyles.timesColumn}>
                  <Text style={modalStyles.timeTextLarger}>
                    {new Date(it.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </RNView>

                <RNView style={modalStyles.connectorColumn}>
                  <RNView style={modalStyles.nodeDot} />
                </RNView>

                <RNView style={modalStyles.assetsColumn}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ alignItems: 'flex-start', paddingVertical: 8 }}
                  >
                    {it.type === 'image' && it.uri ? (
                      <RNView style={modalStyles.assetCard}>
                        <Image source={{ uri: it.uri }} style={modalStyles.assetImage} />
                        {it.text ? <Text style={modalStyles.assetCaption}>{it.text}</Text> : null}
                      </RNView>
                    ) : null}

                    {it.type === 'voice' && it.uri ? (
                      <RNView style={modalStyles.assetCard}>
                        <RNView style={modalStyles.assetContent}>
                          <Text style={{ fontWeight: '700' }}>🎙️ Voice recording</Text>
                          <Text style={{ color: '#666666', fontSize: 12 }}>{it.uri.split('/').pop()}</Text>
                        </RNView>
                      </RNView>
                    ) : null}

                    {it.type === 'text' && it.text ? (
                      <RNView style={modalStyles.assetCard}>
                        <ScrollView style={{ maxHeight: 360 }}>
                          <Text style={modalStyles.assetText}>{it.text}</Text>
                        </ScrollView>
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
   Main screen (HomePage) - LOGIC UPDATED HERE
   -------------------- */
export default function HomePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 420;
  const { user, profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  // SAMPLE TIMELINE DATA (Only used if user is 'patient' or for initial dummy display)
  const [timeline, setTimeline] = useState<TimelineItem[]>([
    { id: '1', type: 'image', uri: 'https://picsum.photos/300/200?1', text: 'Rash evolution, day 1.', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3 },
    { id: '2', type: 'text', text: 'Feeling slightly better than yesterday.', createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 30 },
    { id: '3', type: 'voice', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', text: 'Coughing fit at 9 AM.', createdAt: Date.now() - 1000 * 60 * 60 * 24 },
    { id: '4', type: 'text', text: 'Temperature check: 99.8°F', createdAt: Date.now() - 1000 * 60 * 60 * 24 + 1000 * 60 * 45 },
    { id: '5', type: 'image', uri: 'https://picsum.photos/300/200?5', text: 'New photo of left arm.', createdAt: Date.now() - 1000 * 60 * 60 * 2 },
  ]);

  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const groups = groupByDay(timeline); // keyed groups

  /* --- Provider Timeline View State (NEW) --- */
  // State to hold the UID of the patient currently being viewed by the provider
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  /* ------------------------------------------ */


  /* --------------------
  Provider: fetch patients from Firestore (only if provider) - [UNCHANGED]
  -------------------- */
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientsError, setPatientsError] = useState<string | null>(null);

   useEffect(() => {
    if (!user || profile?.role !== 'provider') {
      setPatients([]);
      setLoadingPatients(false);
      setPatientsError(null);
      return;
    }

    const db = getFirestore(getApp());
    const patientsCol = collection(db, 'profiles');

    setLoadingPatients(true);
    setPatientsError(null);

    const allPatientsQuery = query(patientsCol, where('role', '==', 'patient'));

    const unsubscribe = onSnapshot(
      allPatientsQuery,
      (snapshot) => {
        const patientsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          // Safely cast data to include in the state
          ...(doc.data() as any),
        }));
        setPatients(patientsList);
        setLoadingPatients(false);
      },
      (error) => {
        console.error('Failed to load all patients:', error);
        setPatientsError('Failed to load all patient data.');
        setLoadingPatients(false);
      }
    );

    return () => unsubscribe();

  }, [user, profile]);

  /* --------------------
     Patient UI - [UNCHANGED]
     -------------------- */
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
                    {
                      text: 'Sign Out',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await signOut();
                          router.replace('/signin');
                        } catch (e) {
                          console.error('Sign out failed', e);
                        }
                      },
                    },
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
          <RNView style={styles.patientScreen}>
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

            <Text style={styles.sectionTitle}>Share how you're feeling today</Text>
            <InputSection />

            {expandedDayId && groups[expandedDayId] && (
              <ExpandedDayModal day={groups[expandedDayId]} onClose={() => setExpandedDayId(null)} />
            )}
          </RNView>
        </SafeAreaView>
      </>
    );
  }

  /* --------------------
     Provider UI (View Patient List OR Timeline) - LOGIC UPDATED HERE
     -------------------- */
    if (user && profile?.role === 'provider') {
      
      // CONDITION 1: Show the PatientTimelineView if a patient is selected.
      if (selectedPatientId) {
        return (
          <PatientTimelineView 
            patientId={selectedPatientId} 
            onClose={() => setSelectedPatientId(null)} 
          />
        );
      }

      // CONDITION 2: Show the list of patients (default provider view).
      return (
        <SafeAreaView style={styles.safe}>
          <RNView style={[styles.screen, {justifyContent: 'flex-start' }]}>
            {/* Header card */}
            <RNView style={styles.providerInfoCard}>
              <RNView style={styles.headerRow}>
                <Text style={styles.logo}>MedTrak</Text>

                <Pressable
                  style={({ pressed }) => [styles.signOutButtonHeader, pressed && styles.btnPressed]}
                  onPress={() => {
                    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Sign Out',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await signOut();
                            router.replace('/'); // go to index.tsx
                          } catch (e) {
                            console.error('Sign out failed', e);
                          }
                        },
                      },
                    ]);
                  }}
                >
                  <Text style={styles.signOutText}>Sign Out</Text>
                </Pressable>
              </RNView>

              <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 12, color: '#111' }}>
                Welcome back, {profile?.displayName || user.displayName || 'Provider'}!
              </Text>

              <Text style={{ color: '#666', marginTop: 6 }}>{profile?.email ?? ''}</Text>
            </RNView>

            {/* Patients list */}
            <RNView style={{ width: '100%', paddingHorizontal: 12, marginTop: 12, flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8, paddingHorizontal: 8 }}>Your Patients</Text>

            {loadingPatients ? (
              <RNView style={{ marginTop: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" />
              </RNView>
            ) : patientsError ? (
              <Text style={{ color: 'red' }}>{patientsError}</Text>
            ) : patients.length === 0 ? (
              <Text style={{ color: '#666' }}>No patients assigned yet.</Text>
            ) : (
              <FlatList
                data={patients}
                keyExtractor={(p) => p.uid}
                contentContainerStyle={{ paddingBottom: 48 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      // ACTION: Set the selected patient ID to show the timeline view
                      setSelectedPatientId(item.uid);
                    }}
                    style={({ pressed }) => [
                      {
                        backgroundColor: '#fff',
                        paddingVertical: 14,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        marginBottom: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        shadowColor: '#000',
                        shadowOpacity: 0.04,
                        shadowOffset: { width: 0, height: 6 },
                        shadowRadius: 10,
                        elevation: 2,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <RNView>
                      <Text style={{ fontSize: 16, fontWeight: '700' }}>{item.name ?? item.displayName ?? '(no name)'}</Text>
                      <Text style={{ color: '#666', marginTop: 4 }}>
                        {item.age ? `${item.age} yrs • ` : ''}
                        {item.lastVisit ? `Last visit ${new Date(item.lastVisit).toLocaleDateString()}` : 'No visits yet'}
                      </Text>
                    </RNView>

                    <Text style={{ color: '#0b84ff', fontWeight: '700' }}>Open →</Text>
                  </Pressable>
                )}
              />
            )}
          </RNView>
        </RNView>
      </SafeAreaView>
    );
  }

  /* --------------------
     Not logged in / welcome - [UNCHANGED]
     -------------------- */
  return (
    <SafeAreaView style={styles.safe}>
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

/* --------------------
   InputSection (keeps your previous segmented UI) - [UNCHANGED]
   -------------------- */
function InputSection() {
  const [tab, setTab] = useState<'text' | 'image' | 'voice'>('text');

  return (
    <RNView style={styles.inputSection}>
      <RNView style={styles.segmentedContainer}>
        <Pressable onPress={() => setTab('text')} style={({ pressed }) => [styles.segment, tab === 'text' && styles.segmentActive, pressed && { opacity: 0.9 }]}>
          <Text style={[styles.segmentLabel, tab === 'text' && styles.segmentLabelActive]}>Text</Text>
        </Pressable>
        <RNView style={styles.segmentDivider} />
        <Pressable onPress={() => setTab('image')} style={({ pressed }) => [styles.segment, tab === 'image' && styles.segmentActive, pressed && { opacity: 0.9 }]}>
          <Text style={[styles.segmentLabel, tab === 'image' && styles.segmentLabelActive]}>Image</Text>
        </Pressable>
        <RNView style={styles.segmentDivider} />
        <Pressable onPress={() => setTab('voice')} style={({ pressed }) => [styles.segment, tab === 'voice' && styles.segmentActive, pressed && { opacity: 0.9 }]}>
          <Text style={[styles.segmentLabel, tab === 'voice' && styles.segmentLabelActive]}>Voice</Text>
        </Pressable>
      </RNView>

      <RNView style={styles.instructionsCard}>
        {tab === 'text' && <Text style={styles.instructionsText}>Please enter a brief description of your symptoms, concerns, or updates.</Text>}
        {tab === 'image' && <Text style={styles.instructionsText}>Upload clear photos relevant to your condition (e.g., a rash). Ensure good lighting.</Text>}
        {tab === 'voice' && <Text style={styles.instructionsText}>Record a short voice note describing your symptoms, timing, and any triggers.</Text>}
      </RNView>
    </RNView>
  );
}

/* --------------------
   Styles (main + modal) - [UNCHANGED]
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
  patientHeader: {
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
    // shadow properties might be missing from RNView, but defining them for reference
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  patientInfoText: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
    marginLeft: 23
  },
  backButton: {
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backButtonText: {
    color: '#0b84ff',
    fontSize: 16,
    fontWeight: '600',
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
  sectionTitleTimeline: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    textAlign: 'left',
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 20,
    marginLeft: 23
  },

  topHalf: {
    height: 160,
    marginBottom: 10,
  },
  fullBleed: {
    flex: 1,
  },

  timelineScrollContent: {
    paddingHorizontal: 12,
    alignItems: 'flex-start',
    paddingTop: 25,
    paddingBottom: 20,
  },
  timelineCenterLineHorizontal: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#111',
    left: 0,
    right: 0,
    top: 115,
    zIndex: 0,
  },

  iconSingleRow: { marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  iconTopRow: { marginTop: 6, width: '100%', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 6 },
  iconBottomRow: { marginTop: 2, width: '100%', alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 14, lineHeight: 18 },
  iconPlus: { fontSize: 13, fontWeight: '700', color: '#0b4f8a', backgroundColor: 'rgba(11,132,255,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },

  timelineNodeGroup: { width: 100, marginHorizontal: 16, alignItems: 'center', position: 'relative', paddingTop: 8 },
  dayNodeCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#e6f7ff', alignItems: 'center', justifyContent: 'center', shadowColor: '#0b84ff', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5, zIndex: 2, borderWidth: 3, borderColor: '#fff', marginBottom: 10 },
  dayNodeInner: { alignItems: 'center', justifyContent: 'center' },
  dayCount: { fontSize: 18, fontWeight: '900', color: '#0b4f8a' },
  dayIcons: { marginTop: 4, fontSize: 16 },

  dayDot: { position: 'absolute', top: 86, width: 10, height: 10, borderRadius: 5, backgroundColor: '#111', zIndex: 1 },
  dayFullDate: { marginTop: 20, fontSize: 17, color: '#333', fontWeight: '600' },

  timelineInstructionsCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    marginHorizontal: 20,
  },
  
  inputSection: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  segmentedContainer: { flexDirection: 'row', backgroundColor: '#f2f2f2', borderRadius: 12, padding: 6, alignItems: 'center' },
  segment: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  segmentActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 },
  segmentLabel: { color: '#333', fontWeight: '600' },
  segmentLabelActive: { color: '#111' },
  segmentDivider: { width: 1, height: 18, backgroundColor: '#ddd', marginHorizontal: 6 },
  instructionsCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 },
  instructionsText: { color: '#111' },

  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, backgroundColor: '#F5F5F5' },
  card: { width: '100%', maxWidth: 520, height: '62%', minHeight: 420, paddingHorizontal: 28, paddingVertical: 36, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 22, elevation: 8 },
  logo: { fontSize: 36, fontWeight: '800', marginBottom: 12, textAlign: 'center', color: '#0b0b0b' },
  question: { fontSize: 18, color: '#333', marginBottom: 18, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', width: '100%', marginTop: 20, marginBottom: 12, justifyContent: 'space-around' },
  primaryBtn: { flex: 1, color: '#0b84ff', height: 52, borderRadius: 26, borderWidth: 0, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
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

  assetCard: { width: 260, minHeight: 140, backgroundColor: '#f7fbff', borderRadius: 10, marginRight: 12, padding: 8 },
  assetImage: { width: '100%', height: 120, borderRadius: 8, resizeMode: 'cover' },
  assetText: { color: '#111' },
  assetCaption: { marginTop: 8, color: '#444', fontSize: 13 },
    providerInfoCard: {
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  signOutButtonHeader: { 
    backgroundColor: '#ff3b30', 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    alignItems: 'center',
    height: 38,
  },
});

/* Modal-specific styles (unchanged) */
const modalStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    zIndex: 9999,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSafe: { flex: 1, backgroundColor: '#fff' },
  closeBtn: { position: 'absolute', zIndex: 60, padding: 8, borderRadius: 8, backgroundColor: 'transparent' },
  closeTxt: { fontSize: 20, color: '#111' },

  header: { paddingTop: 12, paddingBottom: 8, alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee' },
  headerDate: { fontSize: 18, fontWeight: '700', color: '#111' },

  bodyWrapper: { flex: 1, position: 'relative', paddingHorizontal: 12 },
  fullVerticalLine: { position: 'absolute', top: 0, bottom: -34, left: 121, width: 2, backgroundColor: '#111', opacity: 0.12, zIndex: 0 },

  body: { flex: 1 },
  interactionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginBottom: 8, minHeight: 120 },
  timesColumn: { width: 92, alignItems: 'flex-end', paddingRight: 12 },
  timeTextLarger: { fontSize: 16, color: '#111', fontWeight: '700' },

  connectorColumn: { width: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8, zIndex: 2 },
  nodeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#111', zIndex: 3 },

  assetsColumn: { flex: 1 },
  assetCard: { alignSelf: 'flex-start', backgroundColor: '#f7fbff', borderRadius: 10, marginRight: 12, padding: 10, maxWidth: 360, minWidth: 120 },
  assetImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, resizeMode: 'cover', marginBottom: 8 },

  assetCaption: { marginTop: 6, color: '#444', fontSize: 12 },
  assetContent: { paddingVertical: 4 },
  assetText: { color: '#111', fontSize: 14 },
});