import React, { useState } from 'react';
import { StyleSheet, Pressable, View as RNView, useWindowDimensions, Alert, ScrollView, View, Text } from 'react-native';
import { Link, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';

export default function HomePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 420;
  const { user, profile, signOut } = useAuth();

  if (user) {
    if (profile?.role === 'patient') {
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
                      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/homepage'); } },
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

              <View style={styles.topHalf}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  style={styles.fullBleed}
                  contentContainerStyle={styles.timelineScrollContent}
                >
                  <View style={styles.timelineContainer}>
                    <RNView style={styles.timelineContent}>
                      <RNView style={styles.timelineItem} />
                      <RNView style={styles.timelineItem} />
                      <RNView style={styles.timelineItem} />
                      <RNView style={styles.timelineItem} />
                      <RNView style={styles.timelineItem} />
                      <RNView style={styles.timelineItem} />
                    </RNView>
                  </View>
                </ScrollView>
              </View>

              {/* Bottom input section with segmented picker */}
              <Text style={styles.sectionTitle}>Share how you're feeling today</Text>
              <InputSection />
            </View>
          </SafeAreaView>
        </>
      );
    }

    // Non-patient (e.g., provider) UI remains unchanged for now
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.screen}>
          <View style={styles.card}>
            <Text style={styles.logo}>MedTrak</Text>
            {profile ? (
              <>
                <Text style={styles.roleText}>Role: Healthcare Provider</Text>
                {profile.license && (
                  <Text style={styles.licenseText}>License: {profile.license}</Text>
                )}
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
                  { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/'); } },
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.card}>
          <Text style={styles.logo}>🔎 MedTrak</Text>
          <Text style={styles.question}>Are you a patient or a provider?</Text>
          <RNView style={[styles.buttonRow]}>
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
          </RNView>
          <Text style={styles.small}>By continuing you agree to our Terms & Privacy.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function InputSection() {
  const [tab, setTab] = useState<'text' | 'image' | 'voice'>('text');

  return (
    <View style={styles.inputSection}>
      <View style={styles.segmentedContainer}>
        <Pressable
          onPress={() => setTab('text')}
          style={({ pressed }) => [
            styles.segment,
            tab === 'text' && styles.segmentActive,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={[styles.segmentLabel, tab === 'text' && styles.segmentLabelActive]}>Text</Text>
        </Pressable>
        <View style={styles.segmentDivider} />
        <Pressable
          onPress={() => setTab('image')}
          style={({ pressed }) => [
            styles.segment,
            tab === 'image' && styles.segmentActive,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={[styles.segmentLabel, tab === 'image' && styles.segmentLabelActive]}>Image</Text>
        </Pressable>
        <View style={styles.segmentDivider} />
        <Pressable
          onPress={() => setTab('voice')}
          style={({ pressed }) => [
            styles.segment,
            tab === 'voice' && styles.segmentActive,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={[styles.segmentLabel, tab === 'voice' && styles.segmentLabelActive]}>Voice</Text>
        </Pressable>
      </View>

      <View style={styles.instructionsCard}>
        {tab === 'text' && (
          <Text style={styles.instructionsText}>
            Please enter a brief description of your symptoms, concerns, or updates.
          </Text>
        )}
        {tab === 'image' && (
          <Text style={styles.instructionsText}>
            Upload clear photos relevant to your condition (e.g., a rash). Ensure good lighting.
          </Text>
        )}
        {tab === 'voice' && (
          <Text style={styles.instructionsText}>
            Record a short voice note describing your symptoms, timing, and any triggers.
          </Text>
        )}
      </View>
    </View>
  );
}

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
    height: '35%',
  },
  fullBleed: {
    flex: 1,
  },
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
  timelineContainer: {
    flex: 1,
    backgroundColor: '#d0ebff',
    paddingVertical: 12,
  },
  timelineContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  timelineScrollContent: {
    paddingHorizontal: 0,
  },
  timelineItem: {
    width: 220,
    height: 120,
    marginHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#a5d8ff',
  },
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#F5F5F5',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    height: '62%',
    minHeight: 420,
    paddingHorizontal: 28,
    paddingVertical: 36,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 8,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    color: '#0b0b0b',
  },
  question: {
    fontSize: 18,
    color: '#333',
    marginBottom: 18,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 20,
    marginBottom: 12,
    justifyContent: 'space-around',
  },
  buttonRowStack: {
    flexDirection: 'column',
  },
  primaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    backgroundColor: '#0b84ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  outlineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0b84ff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonRowStack_primary: {
    marginRight: 0,
    marginBottom: 12,
  },
  primaryTxt: {
    color: '#0b84ff',
    fontWeight: '700',
  },
  outlineTxt: {
    color: '#0b84ff',
    fontWeight: '700',
  },
  btnPressed: { opacity: 0.88 },
  small: {
    marginTop: 45,
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
  welcome: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111',
    marginBottom: 16,
    textAlign: 'center',
  },
  roleText: {
    fontSize: 18,
    color: '#555',
    marginBottom: 8,
    textAlign: 'center',
  },
  licenseText: {
    fontSize: 16,
    color: '#777',
    marginBottom: 8,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    color: '#777',
    marginBottom: 20,
    textAlign: 'center',
  },
  signOutButton: {
    backgroundColor: '#ff3b30',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});

