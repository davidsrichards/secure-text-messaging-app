import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MissingKeyError, errorMessage, useAuth } from '../context/AuthContext';

export default function AuthScreen(): React.JSX.Element {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.form}>
        <Text style={styles.title}>Secure Messenger</Text>
        <Text style={styles.subtitle}>End-to-end encrypted. Keys never leave your device.</Text>
        <TextInput
          style={styles.input}
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isRegister ? 'Create Account' : 'Login'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsRegister((v) => !v)} disabled={busy}>
          <Text style={styles.toggle}>
            {isRegister ? 'Already have an account? Login' : 'No account? Create one'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6fb' },
  form: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', color: '#1b2a49' },
  subtitle: { textAlign: 'center', color: '#5b6b8c', marginBottom: 32, marginTop: 6 },
  input: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#d5dbe8', padding: 14, marginBottom: 12 },
  button: { backgroundColor: '#2d5be3', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  toggle: { color: '#2d5be3', textAlign: 'center', marginTop: 18 },
});
