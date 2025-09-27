// app/signupPatient.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  View as ReactNView
} from 'react-native';

import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text } from '@/components/Themed';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';

export default function SignupPatient() {
  const router = useRouter();
  const { signUp, createPatientProfile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill out all fields');
      return;
    }
    try {
      setLoading(true);
      await signUp(email.trim(), password, name.trim());
      await createPatientProfile(name.trim());
      // Only switch base route; avoid stacking another screen
      router.replace('/');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
      >
        <Feather name="chevron-left" size={20} color="#111" />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Create a Patient account</Text>

            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}
              {/* Sign up button (loading-aware, routes to /homepage on success) */}
              <Pressable
                disabled={loading}
                style={({ pressed }) => [
                  styles.button,
                  (pressed || loading) && styles.buttonPressed,
                ]}
                onPress={async () => {
                  if (loading) return;
                  try {
                    // Perform signup; on success, onSubmit will replace to root
                    await onSubmit?.();
                  } catch (err) {
                    console.error(err);
                  }
                }}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Signing up…' : 'Sign up'}
                </Text>
              </Pressable>

              {/* Sign-in prompt (kept from main to avoid nesting Pressable inside Text) */}
              <ReactNView style={{ alignItems: 'center', marginTop: 10 }}>
                <Text style={{ color: 'black', marginBottom: 4 }}>
                  Already a Patient?
                </Text>

                <Pressable
                  onPress={() => router.push('/signin')}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={{ color: 'blue', fontWeight: '600' }}>Sign In</Text>
                </Pressable>
              </ReactNView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

  errorText: { color: 'red', marginBottom: 8, textAlign: 'center' },

  button: { marginTop: 6, paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b84ff' },
  buttonPressed: { opacity: 0.9 },
  buttonText: { color: 'white', fontWeight: '600' },

  backLink: { marginTop: 12, alignItems: 'center' },
  backLinkText: { color: '#0b84ff' },
});