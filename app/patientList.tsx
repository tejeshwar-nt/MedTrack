import React, { useEffect, useState } from 'react';
import { View as RNView, Text, Pressable, FlatList, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { listPatients } from '../services/profile';
import type { PatientProfile } from '../models/userProfiles';

export default function PatientListScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const rows = await listPatients();
        setPatients(rows);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load patients');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView edges={['left','right','bottom']} style={styles.safe}>
      <RNView style={[styles.screen, { justifyContent: 'flex-start' }]}> 
        {/* Header row */}
        <RNView style={styles.headerRow}>
          <Text style={styles.logo}>MedTrak</Text>
          <Pressable
            style={({ pressed }) => [styles.signOutButtonHeader, pressed && { opacity: 0.85 }]}
            onPress={() => {
              // eslint-disable-next-line no-alert
              // confirm sign out
              // Using Alert in this new screen would require importing; keep simple direct sign out
              (async () => {
                try { await signOut(); router.replace('/'); } catch {}
              })();
            }}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </RNView>

        <Text style={{ fontSize: 20, fontWeight: '700', color: '#111', marginTop: 8, paddingHorizontal: 8 }}>
          Welcome back, {profile?.displayName || user?.displayName || 'Provider'}!
        </Text>
        <Text style={{ color: '#666', marginTop: 6, paddingHorizontal: 8 }}>{profile?.email ?? ''}</Text>

        <RNView style={{ width: '100%', paddingHorizontal: 12, marginTop: 12, flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8, paddingHorizontal: 8 }}>Your Patients</Text>
          {loading ? (
            <RNView style={{ marginTop: 24, alignItems: 'center' }}>
              <ActivityIndicator size={Platform.OS === 'ios' ? 'small' : 24} />
            </RNView>
          ) : error ? (
            <Text style={{ color: 'red' }}>{error}</Text>
          ) : patients.length === 0 ? (
            <Text style={{ color: '#666' }}>No patients found.</Text>
          ) : (
            <FlatList
              data={patients}
              keyExtractor={(p) => p.uid}
              contentContainerStyle={{ paddingBottom: 48 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => router.push({ pathname: '/homepage', params: { currentpatientId: item.uid } })}
                  style={({ pressed }) => [
                    styles.patientRow,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <RNView>
                    <Text style={{ fontSize: 16, fontWeight: '700' }}>{item.displayName ?? '(no name)'}</Text>
                    <Text style={{ color: '#666', marginTop: 4 }}>{item.email}</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F5' },
  screen: { flex: 1, alignItems: 'center', paddingHorizontal: 16 },
  headerRow: { width: '100%', paddingHorizontal: 8, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: 24, fontWeight: '800', color: '#0b0b0b' },
  signOutButtonHeader: { backgroundColor: '#ff3b30', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  signOutText: { color: 'white', fontWeight: '600', fontSize: 14 },
  patientRow: {
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
});


