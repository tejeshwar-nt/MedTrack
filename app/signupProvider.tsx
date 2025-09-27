// app/signupProvider.tsx
// copy SignupPatient and change title to "Create a Provider account" and add any provider-specific fields
import React from 'react';
import { StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text } from '@/components/Themed';
import { Feather } from '@expo/vector-icons';

export default function SignupProvider() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8}>
        <Feather name="chevron-left" size={20} color="#111" />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Create a Provider account</Text>

            <TextInput style={styles.input} placeholder="Full name" placeholderTextColor="#999" />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#999" keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#999" secureTextEntry />
            <TextInput style={styles.input} placeholder="License / NPI (optional)" placeholderTextColor="#999" />

            <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>Sign up</Text>
            </Pressable>

            <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backLink, pressed && { opacity: 0.7 }]}>
              <Text style={styles.backLinkText}>Back</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // same styles as SignupPatient — copy/paste or extract to shared file
  safe: { flex: 1, backgroundColor: '#F5F5F5'},
  backButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  backButtonPressed: { opacity: 0.6 },
  backText: { marginLeft: 6, fontSize: 16, color: '#111' },

  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 32 },

  card: {
    width: '100%',
    maxWidth: 520,
    padding: 22,
    borderRadius: 12,
    alignItems: 'stretch',
    backgroundColor: '#fff',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },

  title: { fontSize: 22, fontWeight: '700', marginBottom: 14, textAlign: 'center', color: '#111' },

  input: { borderWidth: 1, borderColor: '#e6e9ee', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, marginBottom: 12, width: '100%', backgroundColor: 'transparent' },

  button: { marginTop: 6, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b84ff' },
  buttonPressed: { opacity: 0.9 },
  buttonText: { color: 'white', fontWeight: '600' },

  backLink: { marginTop: 12, alignItems: 'center' },
  backLinkText: { color: '#0b84ff' },
});