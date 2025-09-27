// app/index.tsx
import React from 'react';
import { StyleSheet, Pressable, View as RNView, useWindowDimensions } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed'; // keep your themed components

export default function Home() {
  const { width } = useWindowDimensions();
  const isNarrow = width < 420;

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
              <Pressable
                style={({ pressed }) => [styles.outlineBtn, pressed && styles.btnPressed]}
              >
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F5' },

  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#F5F5F5',
  },

  // big card that stretches vertically (60% of screen height)
  card: {
    width: '100%',
    maxWidth: 520,
    height: '62%', // stretches more of the screen vertically
    minHeight: 420,
    paddingHorizontal: 28,
    paddingVertical: 36,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center', // centers children vertically
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    // Android elevation
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

  // stacked layout for narrow screens
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

  // when stacked, give vertical spacing
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

  btnPressed: {
    opacity: 0.88,
  },

  small: {
    marginTop: 45,
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
});