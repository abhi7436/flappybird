import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useGameStore } from '../../src/store/gameStore';
import { Auth } from '../../src/services/api';
import { saveToken } from '../../src/services/storage';
import { loadGuestSession, saveGuestId, guestUsername } from '../../src/services/guestSession';

export default function LoginScreen() {
  const router  = useRouter();
  const setAuth = useGameStore((s) => s.setAuth);
  const setGuest = useGameStore((s) => s.setGuest);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { token, user } = await Auth.login(email.trim().toLowerCase(), password);
      await saveToken(token);
      setAuth(user, token);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login failed', err?.message ?? 'Please try again');
    } finally {
      setLoading(false);
    }
  }

  async function handlePlayAsGuest() {
    try {
      const { id: existingId, highScore } = await loadGuestSession();
      const id = existingId ?? crypto.randomUUID();
      if (!existingId) await saveGuestId(id);
      setGuest(id, guestUsername(id), highScore);
      router.replace('/solo');
    } catch {
      // fallback — still enter solo mode
      const id = `guest_${Date.now()}`;
      setGuest(id, guestUsername(id), 0);
      router.replace('/solo');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <Text style={styles.logo}>🐦 Flappy Birds</Text>
        <Text style={styles.subtitle}>Multiplayer</Text>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@example.com"
            placeholderTextColor="rgba(255,255,255,0.3)"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="rgba(255,255,255,0.3)"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#1a1a2e" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Register</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Guest separator */}
        <View style={styles.separator}>
          <View style={styles.sepLine} />
          <Text style={styles.sepText}>or</Text>
          <View style={styles.sepLine} />
        </View>

        <TouchableOpacity
          style={styles.guestButton}
          onPress={handlePlayAsGuest}
          activeOpacity={0.8}
        >
          <Text style={styles.guestButtonText}>👤 Play as Guest</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logo: { fontSize: 42, textAlign: 'center' },
  subtitle: {
    fontSize: 18,
    color: '#f7c59f',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    padding: 24,
  },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  button: {
    marginTop: 24,
    backgroundColor: '#f7c59f',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#1a1a2e', fontWeight: '800', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  footerLink: { color: '#f7c59f', fontWeight: '700', fontSize: 14 },

  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 10,
  },
  sepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  sepText: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },

  guestButton: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  guestButtonText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 15 },
});
