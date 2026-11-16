import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MissingKeyError, errorMessage, useAuth } from '../context/AuthContext';
import { cardShadow, colors } from '../theme/colors';

export default function AuthScreen(): React.JSX.Element {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const submit = async (): Promise<void> => {
    const name = username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,32}$/.test(name)) {
      Alert.alert('Invalid username', 'Use 3-32 characters: letters, digits, "_", "." or "-".');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (isRegister) await register(name, password);
      else await login(name, password);
    } catch (err) {
      if (err instanceof MissingKeyError) {
        Alert.alert(
          'Encryption key not found',
          'This device has no private key for your account (fresh install or new phone). You can generate a new key pair, but previous messages can no longer be decrypted.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Regenerate Key',
              style: 'destructive',
              onPress: () => {
                login(name, password, true).catch((e: unknown) => Alert.alert('Login failed', errorMessage(e)));
              },
            },
          ],
        );
      } else {
        Alert.alert(isRegister ? 'Registration failed' : 'Login failed', errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          <SafeAreaView edges={['top']} style={styles.hero}>
            <View style={styles.emblem}>
              <Ionicons name="shield-checkmark" size={44} color={colors.verified} />
            </View>
            <Text style={styles.title}>CipherChat E2EE</Text>
            <Text style={styles.subtitle}>Zero-Knowledge Encrypted Messaging</Text>
          </SafeAreaView>

          <View style={styles.card}>
            <View style={styles.segment}>
              {(['Login', 'Create Account'] as const).map((label, i) => {
                const active = isRegister === (i === 1);
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.segmentItem, active && styles.segmentActive]}
                    onPress={() => setIsRegister(i === 1)}
                    disabled={busy}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.button, busy && styles.buttonBusy]} onPress={submit} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{isRegister ? 'Create Account' : 'Login'}</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Ionicons name="key-outline" size={14} color={colors.verified} />
            <Text style={styles.footerText}>Keys generated & stored locally via Curve25519</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  hero: { backgroundColor: colors.dark, alignItems: 'center', paddingTop: 24, paddingBottom: 72, paddingHorizontal: 24 },
  emblem: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.white, letterSpacing: 0.3 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    marginHorizontal: 20,
    marginTop: -48,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  segment: { flexDirection: 'row', backgroundColor: colors.subtle, borderRadius: 999, padding: 4, marginBottom: 20 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.white },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  input: { flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 16, color: colors.text },
  button: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  buttonBusy: { opacity: 0.8 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 'auto', paddingVertical: 24, gap: 6 },
  footerText: { fontSize: 12, color: colors.textSecondary },
});
